export function failure(status: number, message: string): Response {
	return new Response(JSON.stringify({ error: { type: 'gateway_error', message } }), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
	});
}
