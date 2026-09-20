import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import { createOAuthProvider } from '../../../../src/main/mcp/mcp_oauth_create_provider';
import { clientMetadata } from '../../../../src/main/mcp/mcp_oauth_client_metadata';
import { getMcpOAuthRedirectUrl } from '../../../../src/main/mcp/redirect';
import { googleMcpScopes } from '../../../../src/shared/google_mcp';
import type { McpOAuthState } from '../../../../src/main/mcp/mcp_types';

it.each(['gmailmcp', 'calendarmcp', 'drivemcp'])(
	'authorizes %s with a registered client without DCR',
	async (host) => {
		const serverUrl = `https://${host}.googleapis.com/mcp/v1`;
		let state: McpOAuthState = { client_id: 'registered-client', client_secret: 'saved-secret' };
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
				expect(body.get('code_verifier')).toBe(state.codeVerifier);
				expect(body.get('redirect_uri')).toBe(process.env.MCP_OAUTH_REDIRECT_URL);
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
		await expect(auth(provider, { serverUrl, fetchFn, authorizationCode: 'code' })).resolves.toBe(
			'AUTHORIZED'
		);
		expect(state.tokens?.refresh_token).toBe('refresh');
	}
);

it('explains the Google credential requirement before attempting dynamic registration', () => {
	const provider = createOAuthProvider({
		serverUrl: 'https://gmailmcp.googleapis.com/mcp/v1',
		storage: { load: () => ({}), save: jest.fn() },
	});
	expect(() => provider.clientInformation()).toThrow(
		'Google Cloud OAuth client ID and client secret'
	);
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

const originalRedirectUrl = process.env.MCP_OAUTH_REDIRECT_URL;

beforeEach(() => {
	process.env.MCP_OAUTH_REDIRECT_URL = 'https://callback.example.test/oauth';
});

afterEach(() => {
	if (originalRedirectUrl === undefined) delete process.env.MCP_OAUTH_REDIRECT_URL;
	else process.env.MCP_OAUTH_REDIRECT_URL = originalRedirectUrl;
});

it.each([undefined, '', '  '])(
	'requires an explicitly configured redirect instead of a fallback (%s)',
	(value) => {
		if (value === undefined) delete process.env.MCP_OAUTH_REDIRECT_URL;
		else process.env.MCP_OAUTH_REDIRECT_URL = value;
		expect(() => getMcpOAuthRedirectUrl()).toThrow('Set MCP_OAUTH_REDIRECT_URL');
		const provider = createOAuthProvider({ storage: { load: () => ({}), save: jest.fn() } });
		expect(() => provider.redirectUrl).toThrow('Set MCP_OAUTH_REDIRECT_URL');
		expect(() => clientMetadata(false)).toThrow('Set MCP_OAUTH_REDIRECT_URL');
	}
);

it('uses the configured redirect consistently in client metadata and OAuth', () => {
	process.env.MCP_OAUTH_REDIRECT_URL = '  https://custom.example.test/callback  ';
	const provider = createOAuthProvider({ storage: { load: () => ({}), save: jest.fn() } });
	expect(provider.redirectUrl).toBe('https://custom.example.test/callback');
	expect(provider.clientMetadata.redirect_uris).toEqual(['https://custom.example.test/callback']);
});
