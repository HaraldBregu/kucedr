import type { Service } from './services.ts';

const REQUEST_HEADERS = ['content-type', 'accept', 'anthropic-version', 'anthropic-beta', 'idempotency-key'];
const RESPONSE_HEADERS = ['content-type', 'retry-after', 'request-id', 'x-request-id'];
const MAX_BODY_BYTES = 32 * 1024 * 1024;

export async function forward(
	service: Service,
	key: string,
	path: string,
	request: Request,
	send: typeof fetch = fetch
): Promise<Response> {
	const method = service.operations[path];
	if (!method || method !== request.method) return failure(403, 'Operation not allowed');
	const headers = new Headers(service.defaults);
	for (const name of REQUEST_HEADERS) {
		const value = request.headers.get(name);
		if (value) headers.set(name, value);
	}
	for (const [name, value] of Object.entries(service.auth(key))) headers.set(name, value);
	let body: ArrayBuffer | undefined;
	if (method === 'POST') {
		if (Number(request.headers.get('content-length') ?? MAX_BODY_BYTES + 1) > MAX_BODY_BYTES)
			return failure(413, 'Request too large');
		body = await request.arrayBuffer();
		if (body.byteLength > MAX_BODY_BYTES) return failure(413, 'Request too large');
	}
	const query = new URL(request.url).search;
	const upstream = await send(`${service.origin}${path}${query}`, {
		method,
		headers,
		body,
		redirect: 'manual',
		signal: request.signal,
	});
	const responseHeaders = new Headers({ 'cache-control': 'no-store' });
	for (const name of RESPONSE_HEADERS) {
		const value = upstream.headers.get(name);
		if (value) responseHeaders.set(name, value);
	}
	if (upstream.status >= 300 && upstream.status < 400) return failure(502, 'Provider redirect refused');
	if (upstream.status === 401 || upstream.status === 403) {
		await upstream.body?.cancel();
		return failure(upstream.status, 'The provider rejected the saved credential');
	}
	if (!upstream.ok) {
		const text = (await upstream.text()).slice(0, 8192).replaceAll(key, '[redacted]');
		return new Response(text, { status: upstream.status, headers: responseHeaders });
	}
	return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

function failure(status: number, message: string): Response {
	return new Response(JSON.stringify({ error: { type: 'gateway_error', message } }), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
	});
}
