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
jest.mock('../../../../src/main/mcp/mcp_google_fetch', () => ({
	createGoogleMcpFetch: jest.fn(() => 'google-fetch'),
}));

import { getMcpOauth } from '../../../../src/main/mcp/mcp_store';
import { createOAuthProvider } from '../../../../src/main/mcp/mcp_oauth_create_provider';
import { createGoogleMcpFetch } from '../../../../src/main/mcp/mcp_google_fetch';
import { buildTransport } from '../../../../src/main/mcp/mcp_client_build_transport';

const originalFetch = global.fetch;
const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
const originalGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

beforeEach(() => {
	jest.clearAllMocks();
	process.env.GOOGLE_CLIENT_ID = 'environment-id';
	process.env.GOOGLE_CLIENT_SECRET = 'environment-secret';
	mockHttpTransport.mockImplementation((_url, options) => ({ options }));
});

afterAll(() => {
	global.fetch = originalFetch;
	if (originalGoogleClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
	else process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
	if (originalGoogleClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
	else process.env.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret;
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

it('requires explicit credentials for the GitHub remote MCP server', () => {
	expect(() =>
		buildTransport('github', { type: 'http', url: 'https://api.githubcopilot.com/mcp/' })
	).toThrow(
		'GitHub remote MCP requires a personal access token. GitHub does not support dynamic client registration.'
	);
	expect(() =>
		buildTransport('github', {
			type: 'http',
			url: 'https://api.githubcopilot.com/mcp/',
			token: 'github-token',
		})
	).not.toThrow();
});

it('creates local transports directly from the shared MCP configuration', () => {
	expect(() =>
		buildTransport('local', { type: 'stdio', command: process.execPath, args: ['server.mjs'] })
	).not.toThrow();
});

it.each(['gmailmcp.googleapis.com', 'calendarmcp.googleapis.com', 'drivemcp.googleapis.com', 'people.googleapis.com'])(
	'ignores persisted credentials and uses the environment for %s',
	(host) => {
		jest
			.mocked(getMcpOauth)
			.mockReturnValue({ client_id: 'saved-id', client_secret: 'saved-secret' });
		buildTransport('saved-google', {
			type: 'http',
			url: `https://${host}/mcp/v1`,
			client_id: 'configured-id',
			client_secret: 'configured-secret',
		});
		expect(createOAuthProvider).toHaveBeenCalledWith(
			expect.objectContaining({ clientId: 'environment-id', clientSecret: 'environment-secret' })
		);
	}
);

it('uses the Google compatibility fetch only for Google MCP endpoints', () => {
	buildTransport('gmail', { type: 'http', url: 'https://gmailmcp.googleapis.com/mcp/v1' });
	expect(createGoogleMcpFetch).toHaveBeenCalledTimes(1);
	expect(mockHttpTransport.mock.calls[0]?.[1]?.fetch).toBe('google-fetch');
});
