const mockHttpTransport = jest.fn();

jest.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
	StreamableHTTPClientTransport: mockHttpTransport,
}));
jest.mock('../../../../src/main/mcp/mcp_oauth_create_provider', () => ({
	createOAuthProvider: jest.fn(() => ({})),
}));
jest.mock('../../../../src/main/mcp/mcp_store', () => ({
	getMcpOauth: jest.fn(() => ({})),
	saveMcpOauth: jest.fn(),
}));

import { buildTransport } from '../../../../src/main/mcp/mcp_client_build_transport';

const originalFetch = global.fetch;

beforeEach(() => {
	jest.clearAllMocks();
	mockHttpTransport.mockImplementation((_url, options) => ({ options }));
});

afterAll(() => {
	global.fetch = originalFetch;
});

it('rejects oversized streamed HTTP responses before the MCP SDK parses them', async () => {
	global.fetch = jest.fn().mockResolvedValue(new Response('x'.repeat(1_000_001)));
	buildTransport('remote', { type: 'http', url: 'https://mcp.example/rpc' });
	const boundedFetch = mockHttpTransport.mock.calls[0]?.[1]?.fetch as typeof fetch;

	const response = await boundedFetch('https://mcp.example/rpc');
	await expect(response.text()).rejects.toThrow('1 MB wire limit');
	expect((global.fetch as jest.Mock).mock.calls[0]?.[1]?.redirect).toBe('error');
});

it('rejects an oversized Content-Length without consuming the body', async () => {
	const cancel = jest.fn();
	global.fetch = jest.fn().mockResolvedValue({
		headers: new Headers({ 'content-length': '1000001' }),
		body: { cancel },
	});
	buildTransport('remote', { type: 'http', url: 'https://mcp.example/rpc' });
	const boundedFetch = mockHttpTransport.mock.calls[0]?.[1]?.fetch as typeof fetch;

	await expect(boundedFetch('https://mcp.example/rpc')).rejects.toThrow('1 MB wire limit');
	expect(cancel).toHaveBeenCalledTimes(1);
});

it('requires HTTPS except for loopback development servers', () => {
	expect(() =>
		buildTransport('remote', { type: 'http', url: 'http://mcp.example/rpc', token: 'secret' })
	).toThrow('Remote MCP servers must use HTTPS');
	expect(() =>
		buildTransport('local', { type: 'http', url: 'http://127.0.0.1:3000/rpc' })
	).not.toThrow();
});

it('creates local transports directly from the shared MCP configuration', () => {
	expect(() =>
		buildTransport('local', { type: 'stdio', command: process.execPath, args: ['server.mjs'] })
	).not.toThrow();
});
