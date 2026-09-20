import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import { createOAuthProvider } from '../../../../src/main/mcp/mcp_oauth_create_provider';
import { getMcpOAuthRedirectUrl } from '../../../../src/main/mcp/redirect';
import { googleMcpScopes } from '../../../../src/shared/google_mcp';
import type { McpOAuthState } from '../../../../src/main/mcp/mcp_types';

it.each(['gmailmcp', 'calendarmcp', 'drivemcp'])(
	'authorizes %s with a registered client without DCR',
	async (host) => {
		const serverUrl = `https://${host}.googleapis.com/mcp/v1`;
		let state: McpOAuthState = { client_id: 'old-client', client_secret: 'old-secret' };
		const redirect = jest.fn();
		const provider = createOAuthProvider({
			serverUrl,
			storage: {
				load: () => state,
				save: (value) => {
					state = value;
				},
			},
			onRedirect: redirect,
		});
		const fetchFn = jest.fn(async (input: string | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.includes('/.well-known/oauth-protected-resource')) {
				return Response.json({
					resource: serverUrl,
					authorization_servers: ['https://accounts.google.com'],
					scopes_supported: ['https://mail.google.com/'],
				});
			}
			if (url.includes('/.well-known/')) {
				return Response.json({
					issuer: 'https://accounts.google.com',
					authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
					token_endpoint: 'https://oauth2.googleapis.com/token',
					response_types_supported: ['code'],
					code_challenge_methods_supported: ['S256'],
					token_endpoint_auth_methods_supported: ['client_secret_post'],
				});
			}
			if (url === 'https://oauth2.googleapis.com/token') {
				const body = new URLSearchParams(String(init?.body));
				expect(body.get('client_id')).toBe('registered-client');
				expect(body.get('client_secret')).toBe('saved-secret');
				expect(body.get('code_verifier')).toBe(await provider.codeVerifier());
				expect(body.get('redirect_uri')).toBe(process.env.MCP_CLIENT_REDIRECT_URL);
				return Response.json({
					access_token: 'access',
					token_type: 'Bearer',
					refresh_token: 'refresh',
				});
			}
			throw new Error(`Unexpected request: ${url}`);
		});
		await expect(auth(provider, { serverUrl, fetchFn })).resolves.toBe('REDIRECT');
		const url = redirect.mock.calls[0][0] as URL;
		expect(url.searchParams.get('client_id')).toBe('registered-client');
		expect(url.searchParams.get('scope')).toBe(googleMcpScopes(serverUrl));
		expect(url.searchParams.get('access_type')).toBe('offline');
		expect(url.searchParams.get('prompt')).toBe('consent');
		expect(url.searchParams.get('code_challenge_method')).toBe('S256');
		expect(url.searchParams.get('state')).toBe(await provider.state!());
		expect(url.searchParams.get('state')).toMatch(/^[a-f0-9]{64}$/);
		await expect(auth(provider, { serverUrl, fetchFn, authorizationCode: 'code' })).resolves.toBe(
			'AUTHORIZED'
		);
		expect(state.tokens?.refresh_token).toBe('refresh');
	}
);

it('explains the Google credential requirement before attempting dynamic registration', () => {
	delete process.env.MCP_GOOGLE_CLIENT_ID;
	delete process.env.MCP_GOOGLE_CLIENT_SECRET;
	const provider = createOAuthProvider({
		serverUrl: 'https://gmailmcp.googleapis.com/mcp/v1',
		storage: { load: () => ({}), save: jest.fn() },
	});
	expect(() => provider.clientInformation()).toThrow('MCP_GOOGLE_CLIENT_ID');
});

it('leaves generic OAuth registration and authorization parameters unchanged', () => {
	const redirect = jest.fn();
	const provider = createOAuthProvider({
		serverUrl: 'https://example.com/mcp',
		storage: { load: () => ({}), save: jest.fn() },
		onRedirect: redirect,
	});
	expect(provider.clientInformation()).toBeUndefined();
	const url = new URL('https://example.com/authorize?scope=read');
	provider.redirectToAuthorization(url);
	expect(redirect).toHaveBeenCalledWith(url);
	expect(url.searchParams.toString()).toBe('scope=read');
	expect(googleMcpScopes('https://gmailmcp.googleapis.com.evil.test/mcp/v1')).toBeUndefined();
});

const originalRedirectUrl = process.env.MCP_CLIENT_REDIRECT_URL;
const originalGoogleClientId = process.env.MCP_GOOGLE_CLIENT_ID;
const originalGoogleClientSecret = process.env.MCP_GOOGLE_CLIENT_SECRET;

beforeEach(() => {
	process.env.MCP_CLIENT_REDIRECT_URL = 'http://127.0.0.1:3001/oauth/callback';
	process.env.MCP_GOOGLE_CLIENT_ID = 'registered-client';
	process.env.MCP_GOOGLE_CLIENT_SECRET = 'saved-secret';
});

afterEach(() => {
	if (originalGoogleClientId === undefined) delete process.env.MCP_GOOGLE_CLIENT_ID;
	else process.env.MCP_GOOGLE_CLIENT_ID = originalGoogleClientId;
	if (originalGoogleClientSecret === undefined) delete process.env.MCP_GOOGLE_CLIENT_SECRET;
	else process.env.MCP_GOOGLE_CLIENT_SECRET = originalGoogleClientSecret;
	if (originalRedirectUrl === undefined) delete process.env.MCP_CLIENT_REDIRECT_URL;
	else process.env.MCP_CLIENT_REDIRECT_URL = originalRedirectUrl;
});

it('uses a dedicated callback independent of account authentication', () => {
	delete process.env.MCP_CLIENT_REDIRECT_URL;
	expect(getMcpOAuthRedirectUrl()).toBe('http://127.0.0.1:3001/oauth/callback');
});

it.each([
	'https://example.com/callback',
	'http://example.com:3001/callback',
	'http://127.0.0.1/callback',
])('rejects callbacks that cannot be owned by the desktop app: %s', (value) => {
	process.env.MCP_CLIENT_REDIRECT_URL = value;
	expect(() => getMcpOAuthRedirectUrl()).toThrow('HTTP loopback');
});

it('uses the configured redirect consistently in client metadata and OAuth', () => {
	process.env.MCP_CLIENT_REDIRECT_URL = '  http://127.0.0.1:3002/callback  ';
	const provider = createOAuthProvider({ storage: { load: () => ({}), save: jest.fn() } });
	expect(provider.redirectUrl).toBe('http://127.0.0.1:3002/callback');
	expect(provider.clientMetadata.redirect_uris).toEqual(['http://127.0.0.1:3002/callback']);
});

it('uses Google client credentials only from the environment', () => {
	const provider = createOAuthProvider({
		serverUrl: 'https://gmailmcp.googleapis.com/mcp/v1',
		clientId: 'ignored',
		clientSecret: 'ignored',
		storage: { load: () => ({ client_id: 'stored', client_secret: 'stored' }), save: jest.fn() },
	});
	expect(provider.clientInformation()).toEqual({
		client_id: 'registered-client',
		client_secret: 'saved-secret',
	});
	delete process.env.MCP_GOOGLE_CLIENT_ID;
	const missing = createOAuthProvider({
		serverUrl: 'https://gmailmcp.googleapis.com/mcp/v1',
		storage: { load: () => ({ client_id: 'stored', client_secret: 'stored' }), save: jest.fn() },
	});
	expect(() => missing.clientInformation()).toThrow('MCP_GOOGLE_CLIENT_ID');
});

it('isolates pending PKCE verifiers and state between attempts', async () => {
	const storage = { load: () => ({}), save: jest.fn() };
	const first = createOAuthProvider({ storage });
	const second = createOAuthProvider({ storage });
	await first.saveCodeVerifier('first');
	await second.saveCodeVerifier('second');
	expect(await first.codeVerifier()).toBe('first');
	expect(await second.codeVerifier()).toBe('second');
	expect(await first.state!()).not.toBe(await second.state!());
	await first.invalidateCredentials!('verifier');
	expect(() => first.codeVerifier()).toThrow('Missing OAuth code verifier');
	expect(storage.save).toHaveBeenCalledWith({});
});
