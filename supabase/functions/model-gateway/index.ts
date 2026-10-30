import { authenticate } from '../_shared/auth.ts';
import { forward } from '../_shared/forward.ts';
import { rpc } from '../_shared/rpc.ts';
import { services } from '../_shared/services.ts';

const ROUTE = /\/model-gateway\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/[a-z0-9_/-]*)$/i;

Deno.serve(async (request) => {
	const match = new URL(request.url).pathname.match(ROUTE);
	if (!match) return failure(404, 'Not found');
	if (request.method !== 'GET' && request.method !== 'POST') return failure(405, 'Method not allowed');
	let auth: Awaited<ReturnType<typeof authenticate>>;
	try {
		auth = await authenticate(request);
	} catch {
		return failure(401, 'Sign in required');
	}
	const { ownerId, database } = auth;
	let lease: string | null = null;
	const release = () => {
		if (lease) void rpc(database, 'credential_release', { p_lease: lease }).catch(() => undefined);
		lease = null;
	};
	try {
		if (!(await rpc<boolean>(database, 'credential_rate_limit', {
			p_user_id: ownerId, p_bucket: 'gateway', p_limit: 120, p_window_seconds: 60,
		}))) return failure(429, 'Too many requests');
		const [row] = await rpc<{ service: string; secret: string }[]>(database, 'credential_secret', {
			p_user_id: ownerId, p_id: match[1],
		});
		const service = row && services[row.service];
		if (!service) return failure(404, 'Credential not found');
		lease = await rpc<string | null>(database, 'credential_acquire', {
			p_user_id: ownerId, p_max: 8, p_ttl_seconds: 600,
		});
		if (!lease) return failure(429, 'Too many concurrent requests');
		request.signal.addEventListener('abort', release);
		const response = await forward(service, row.secret, match[2], request);
		if (!response.body) {
			release();
			return response;
		}
		const body = response.body.pipeThrough(new TransformStream({ flush: release }));
		return new Response(body, { status: response.status, headers: response.headers });
	} catch {
		release();
		return failure(request.signal.aborted ? 499 : 502, 'Provider request failed');
	}
});

function failure(status: number, message: string): Response {
	return new Response(JSON.stringify({ error: { type: 'gateway_error', message } }), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
	});
}
