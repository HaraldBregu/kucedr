import { createGoogleMcpFetch } from '../../../../src/main/mcp/mcp_google_fetch';

it('normalizes a non-successful tools list response containing a JSON-RPC result', async () => {
	const fetchImplementation = jest.fn().mockResolvedValue(
		new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { tools: [] } }), {
			status: 400,
			headers: { 'content-type': 'application/json' },
		})
	);

	const response = await createGoogleMcpFetch(fetchImplementation)(
		'https://gmailmcp.googleapis.com/mcp/v1',
		{
			method: 'POST',
			body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
		}
	);

	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ jsonrpc: '2.0', id: 1, result: { tools: [] } });
});

it('preserves genuine tools list errors', async () => {
	const fetchImplementation = jest.fn().mockResolvedValue(
		new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32603 } }), {
			status: 400,
			headers: { 'content-type': 'application/json' },
		})
	);

	const response = await createGoogleMcpFetch(fetchImplementation)(
		'https://gmailmcp.googleapis.com/mcp/v1',
		{
			method: 'POST',
			body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
		}
	);

	expect(response.status).toBe(400);
	expect(await response.json()).toEqual({ jsonrpc: '2.0', id: 1, error: { code: -32603 } });
});
