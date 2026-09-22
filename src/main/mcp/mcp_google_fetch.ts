import { createMcpFetch } from './mcp_fetch';

export function createGoogleMcpFetch(fetchImplementation: typeof fetch = fetch): typeof fetch {
	const boundedFetch = createMcpFetch(fetchImplementation);
	return async (input, init): Promise<Response> => {
		const response = await boundedFetch(input, init);
		if (response.ok || typeof init?.body !== 'string') return response;

		let request: { method?: unknown };
		try {
			request = JSON.parse(init.body) as { method?: unknown };
		} catch {
			return response;
		}
		if (request.method !== 'tools/list') return response;

		const text = await response.text();
		let payload: { jsonrpc?: unknown; result?: unknown; error?: unknown };
		try {
			payload = JSON.parse(text) as { jsonrpc?: unknown; result?: unknown; error?: unknown };
		} catch {
			return new Response(text, {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
			});
		}
		if (payload.jsonrpc !== '2.0' || payload.result === undefined || payload.error !== undefined) {
			return new Response(text, {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
			});
		}
		return new Response(text, { status: 200, headers: response.headers });
	};
}
