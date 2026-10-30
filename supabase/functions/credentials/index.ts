import { authenticate } from '../_shared/auth.ts';
import { json } from '../_shared/json.ts';
import { probe } from '../_shared/probe.ts';
import { rpc, RpcError } from '../_shared/rpc.ts';
import { services } from '../_shared/services.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Row {
	id: string;
	service: string;
	label: string;
	last_four: string | null;
	created_at: string;
	updated_at: string;
}

Deno.serve(async (request) => {
	if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
	if (Number(request.headers.get('content-length') ?? 0) > 32_768)
		return json({ error: 'Request too large' }, 413);
	let auth: Awaited<ReturnType<typeof authenticate>>;
	try {
		auth = await authenticate(request);
	} catch {
		return json({ error: 'Sign in required' }, 401);
	}
	const { ownerId, database } = auth;
	let body: Record<string, unknown>;
	try {
		body = await request.json();
		if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
	} catch {
		return json({ error: 'Invalid request' }, 400);
	}
	try {
		if (!(await rpc<boolean>(database, 'credential_rate_limit', {
			p_user_id: ownerId, p_bucket: 'credentials', p_limit: 60, p_window_seconds: 60,
		}))) return json({ error: 'Too many requests' }, 429);

		const id = body.id;
		const secret = typeof body.secret === 'string' ? body.secret.trim() : '';
		const label = typeof body.label === 'string' ? body.label.trim() : '';
		const validId = typeof id === 'string' && UUID.test(id);
		const validSecret = secret.length >= 8 && secret.length <= 16_384 && !/\s/.test(secret);
		const validLabel = label.length >= 1 && label.length <= 100;
		const view = (row: Row) => ({
			id: row.id, service: row.service, label: row.label, lastFour: row.last_four,
			createdAt: row.created_at, updatedAt: row.updated_at,
		});

		switch (body.action) {
			case 'list': {
				const rows = await rpc<Row[]>(database, 'credential_list', { p_user_id: ownerId });
				return json({ credentials: rows.map(view) });
			}
			case 'create': {
				const requestId = body.requestId;
				if (typeof body.service !== 'string' || !Object.hasOwn(services, body.service) ||
					!validSecret || !validLabel ||
					(requestId !== undefined && (typeof requestId !== 'string' || !UUID.test(requestId))))
					return json({ error: 'Invalid credential' }, 400);
				const [row] = await rpc<Row[]>(database, 'credential_create', {
					p_user_id: ownerId, p_service: body.service, p_label: label, p_secret: secret,
					p_request_id: requestId ?? null,
				});
				return json({ credential: view(row) });
			}
			case 'replace': {
				if (!validId || !validSecret) return json({ error: 'Invalid credential' }, 400);
				const [row] = await rpc<Row[]>(database, 'credential_replace', {
					p_user_id: ownerId, p_id: id, p_secret: secret,
				});
				return json({ credential: view(row) });
			}
			case 'rename': {
				if (!validId || !validLabel) return json({ error: 'Invalid credential' }, 400);
				const [row] = await rpc<Row[]>(database, 'credential_rename', {
					p_user_id: ownerId, p_id: id, p_label: label,
				});
				return json({ credential: view(row) });
			}
			case 'delete': {
				if (!validId) return json({ error: 'Invalid credential' }, 400);
				await rpc(database, 'credential_delete', { p_user_id: ownerId, p_id: id });
				return json({ ok: true });
			}
			case 'test': {
				if (!validId) return json({ error: 'Invalid credential' }, 400);
				const [row] = await rpc<{ service: string; secret: string }[]>(database, 'credential_secret', {
					p_user_id: ownerId, p_id: id,
				});
				const service = row && services[row.service];
				if (!service) return json({ error: 'Credential not found' }, 404);
				try {
					return json({ valid: await probe(service, row.secret) });
				} catch {
					return json({ error: 'Provider unavailable' }, 502);
				}
			}
			default:
				return json({ error: 'Invalid request' }, 400);
		}
	} catch (error) {
		if (error instanceof RpcError && error.code === 'P0002') return json({ error: 'Credential not found' }, 404);
		if (error instanceof RpcError && error.code === '22023') return json({ error: 'Invalid credential' }, 400);
		return json({ error: 'Request failed' }, 500);
	}
});
