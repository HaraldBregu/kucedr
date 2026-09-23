export function json(value: unknown, status = 200) {
	return new Response(JSON.stringify(value), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
	});
}
