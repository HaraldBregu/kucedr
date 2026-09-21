import { googleOAuthOptions } from '../../../../src/main/mcp/google';
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
			...googleOAuthOptions(serverUrl),
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
				expect(body.get('redirect_uri')).toBe(process.env.CLIENT_REDIRECT_URL);
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
		expect(state.tokensClientId).toBe('registered-client');
	}
);

it('explains the Google credential requirement before attempting dynamic registration', () => {
	delete process.env.GOOGLE_CLIENT_ID;
	expect(() => googleOAuthOptions('https://gmailmcp.googleapis.com/mcp/v1')).toThrow(
		'GOOGLE_CLIENT_ID'
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

const originalRedirectUrl = process.env.CLIENT_REDIRECT_URL;
const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
const originalGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

beforeEach(() => {
	process.env.CLIENT_REDIRECT_URL = 'http://127.0.0.1:3001/oauth/callback';
	process.env.GOOGLE_CLIENT_ID = 'registered-client';
	process.env.GOOGLE_CLIENT_SECRET = 'saved-secret';
});

afterEach(() => {
	if (originalGoogleClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
	else process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
	if (originalGoogleClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
	else process.env.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret;
	if (originalRedirectUrl === undefined) delete process.env.CLIENT_REDIRECT_URL;
	else process.env.CLIENT_REDIRECT_URL = originalRedirectUrl;
});

it('uses a dedicated callback independent of account authentication', () => {
	delete process.env.CLIENT_REDIRECT_URL;
	expect(getMcpOAuthRedirectUrl()).toBe('http://127.0.0.1:3001/oauth/callback');
});

it.each([
	'https://example.com/callback',
	'http://example.com:3001/callback',
	'http://127.0.0.1/callback',
])('rejects callbacks that cannot be owned by the desktop app: %s', (value) => {
	process.env.CLIENT_REDIRECT_URL = value;
	expect(() => getMcpOAuthRedirectUrl()).toThrow('HTTP loopback');
});

it('uses the configured redirect consistently in client metadata and OAuth', () => {
	process.env.CLIENT_REDIRECT_URL = '  http://127.0.0.1:3002/callback  ';
	const provider = createOAuthProvider({ storage: { load: () => ({}), save: jest.fn() } });
	expect(provider.redirectUrl).toBe('http://127.0.0.1:3002/callback');
	expect(provider.clientMetadata.redirect_uris).toEqual(['http://127.0.0.1:3002/callback']);
});

it('isolates Google options from generic MCP servers and permits public Google clients', () => {
	expect(googleOAuthOptions('https://example.com/mcp')).toEqual({});
	delete process.env.GOOGLE_CLIENT_SECRET;
	const provider = createOAuthProvider({
		...googleOAuthOptions('https://gmailmcp.googleapis.com/mcp/v1'),
		storage: { load: () => ({ client_id: 'stored', client_secret: 'stored' }), save: jest.fn() },
	});
	expect(provider.clientInformation()).toEqual({
		client_id: 'registered-client',
		client_secret: undefined,
	});
	expect(provider.clientMetadata.token_endpoint_auth_method).toBe('none');
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

it('registers and authorizes a generic public MCP client with discovered metadata and pins discovery', async () => {
	const serverUrl = 'https://generic.example/mcp';
	const redirectUrl = 'http://127.0.0.1:49152/oauth/callback';
	let stored: McpOAuthState = {};
	const redirect = jest.fn();
	const provider = createOAuthProvider({
		redirectUrl,
		state: 'attempt-state',
		storage: {
			load: () => stored,
			save: (value) => {
				stored = value;
			},
		},
		onRedirect: redirect,
	});
	let discoveryRequests = 0;
	const fetchFn = jest.fn(async (input: string | URL, init?: RequestInit) => {
		const url = String(input);
		if (url.includes('/.well-known/oauth-protected-resource')) {
			discoveryRequests++;
			return Response.json({
				resource: serverUrl,
				authorization_servers: ['https://issuer.example'],
				scopes_supported: ['tools:read'],
			});
		}
		if (url.includes('/.well-known/')) {
			discoveryRequests++;
			return Response.json({
				issuer: 'https://issuer.example',
				authorization_endpoint: 'https://issuer.example/authorize',
				token_endpoint: 'https://issuer.example/token',
				registration_endpoint: 'https://issuer.example/register',
				response_types_supported: ['code'],
				code_challenge_methods_supported: ['S256'],
				token_endpoint_auth_methods_supported: ['none'],
			});
		}
		if (url === 'https://issuer.example/register') {
			const metadata = JSON.parse(String(init?.body));
			expect(metadata.redirect_uris).toEqual([redirectUrl]);
			expect(metadata.token_endpoint_auth_method).toBe('none');
			return Response.json({ ...metadata, client_id: 'dynamic-client' }, { status: 201 });
		}
		if (url === 'https://issuer.example/token') {
			const body = new URLSearchParams(String(init?.body));
			expect(body.get('client_id')).toBe('dynamic-client');
			expect(body.has('client_secret')).toBe(false);
			expect(body.get('code_verifier')).toBe(await provider.codeVerifier());
			expect(body.get('redirect_uri')).toBe(redirectUrl);
			expect(body.get('resource')).toBe(serverUrl);
			return Response.json({
				access_token: 'generic-access',
				token_type: 'Bearer',
				refresh_token: 'generic-refresh',
			});
		}
		throw new Error(`Unexpected request: ${url}`);
	});
	await expect(auth(provider, { serverUrl, fetchFn })).resolves.toBe('REDIRECT');
	const authorization = redirect.mock.calls[0][0] as URL;
	expect(authorization.origin).toBe('https://issuer.example');
	expect(authorization.searchParams.get('redirect_uri')).toBe(redirectUrl);
	expect(authorization.searchParams.get('state')).toBe('attempt-state');
	expect(authorization.searchParams.get('scope')).toBe('tools:read');
	expect(authorization.searchParams.get('resource')).toBe(serverUrl);
	expect(authorization.searchParams.get('code_challenge_method')).toBe('S256');
	expect(authorization.searchParams.get('code_challenge')).toBeTruthy();
	expect(authorization.searchParams.has('access_type')).toBe(false);
	const beforeExchange = discoveryRequests;
	await expect(
		auth(provider, { serverUrl, fetchFn, authorizationCode: 'generic-code' })
	).resolves.toBe('AUTHORIZED');
	expect(discoveryRequests).toBe(beforeExchange);
	expect(stored.tokens?.access_token).toBe('generic-access');
	expect(stored.tokensClientId).toBe('dynamic-client');
});

it('refreshes generic OAuth tokens without losing a refresh token omitted by the issuer', async () => {
	let stored: McpOAuthState = {
		tokensClientId: 'public-client',
		tokens: { access_token: 'old', refresh_token: 'keep-refresh', token_type: 'Bearer' },
	};
	const provider = createOAuthProvider({
		clientId: 'public-client',
		storage: {
			load: () => stored,
			save: (value) => {
				stored = value;
			},
		},
	});
	const fetchFn = jest.fn(async (input: string | URL, init?: RequestInit) => {
		const url = String(input);
		if (url.includes('/.well-known/oauth-protected-resource'))
			return Response.json({
				resource: 'https://generic.example/mcp',
				authorization_servers: ['https://issuer.example'],
			});
		if (url.includes('/.well-known/'))
			return Response.json({
				issuer: 'https://issuer.example',
				authorization_endpoint: 'https://issuer.example/authorize',
				token_endpoint: 'https://issuer.example/token',
				response_types_supported: ['code'],
				token_endpoint_auth_methods_supported: ['none'],
			});
		if (url === 'https://issuer.example/token') {
			const body = new URLSearchParams(String(init?.body));
			expect(body.get('grant_type')).toBe('refresh_token');
			expect(body.get('refresh_token')).toBe('keep-refresh');
			return Response.json({ access_token: 'renewed', token_type: 'Bearer' });
		}
		throw new Error(`Unexpected request: ${url}`);
	});
	await expect(auth(provider, { serverUrl: 'https://generic.example/mcp', fetchFn })).resolves.toBe(
		'AUTHORIZED'
	);
	expect(stored.tokens).toEqual({
		access_token: 'renewed',
		token_type: 'Bearer',
		refresh_token: 'keep-refresh',
	});
});

it('does not mix an explicit public client with a previously registered confidential client', () => {
	const provider = createOAuthProvider({
		clientId: 'public-client',
		storage: {
			load: () => ({ client_id: 'old-client', client_secret: 'old-secret' }),
			save: jest.fn(),
		},
	});
	expect(provider.clientInformation()).toEqual({
		client_id: 'public-client',
		client_secret: undefined,
	});
	expect(provider.clientMetadata.token_endpoint_auth_method).toBe('none');
});

it('registers a changed dynamic callback again without reusing tokens for the old client', async () => {
	let stored: McpOAuthState = {
		client_id: 'old-dynamic-client',
		tokensClientId: 'old-dynamic-client',
		redirect_uris: ['http://127.0.0.1:4000/oauth/callback'],
		tokens: { access_token: 'old-access', refresh_token: 'old-refresh', token_type: 'Bearer' },
	};
	const provider = createOAuthProvider({
		redirectUrl: 'http://127.0.0.1:4001/oauth/callback',
		onRedirect: jest.fn(),
		storage: {
			load: () => stored,
			save: (value) => {
				stored = value;
			},
		},
	});
	expect(provider.clientInformation()).toBeUndefined();
	await provider.saveClientInformation!({
		client_id: 'new-client',
		redirect_uris: ['http://127.0.0.1:4001/oauth/callback'],
	});
	expect(provider.clientInformation()).toMatchObject({ client_id: 'new-client' });
	expect(provider.tokens()).toBeUndefined();
});

it.each(['https://gmailmcp.googleapis.com/mcp/v1', 'https://generic.example/mcp'])(
	'rejects tokens issued to another configured client for %s',
	(serverUrl) => {
		const provider = createOAuthProvider({
			...googleOAuthOptions(serverUrl),
			clientId: 'registered-client',
			storage: {
				load: () => ({
					client_id: 'old-client',
					tokensClientId: 'old-client',
					tokens: {
						access_token: 'old-access',
						refresh_token: 'old-refresh',
						token_type: 'Bearer',
					},
				}),
				save: jest.fn(),
			},
		});
		expect(provider.tokens()).toBeUndefined();
	}
);

it.each([undefined, 'another-client'])('rejects an unknown token client binding: %s', (binding) => {
	const provider = createOAuthProvider({
		storage: {
			load: () => ({
				client_id: 'dynamic-client',
				tokensClientId: binding,
				tokens: { access_token: 'old-access', token_type: 'Bearer' },
			}),
			save: jest.fn(),
		},
	});
	expect(provider.tokens()).toBeUndefined();
});

it.each([
	{ binding: 'old-client', newGrant: false },
	{ binding: 'current-client', newGrant: true },
])('does not retain an unrelated refresh token: %j', async ({ binding, newGrant }) => {
	let stored: McpOAuthState = {
		tokensClientId: binding,
		tokens: { access_token: 'old-access', refresh_token: 'old-refresh', token_type: 'Bearer' },
	};
	const provider = createOAuthProvider({
		clientId: 'current-client',
		storage: {
			load: () => stored,
			save: (value) => {
				stored = value;
			},
		},
	});
	if (newGrant) await provider.saveCodeVerifier('new-grant');
	await provider.saveTokens({ access_token: 'new-access', token_type: 'Bearer' });
	expect(stored.tokens?.refresh_token).toBeUndefined();
	expect(stored.tokensClientId).toBe('current-client');
	expect(stored.client_id).toBeUndefined();
	expect(provider.tokens()?.access_token).toBe('new-access');
	expect(() => provider.codeVerifier()).toThrow('Missing OAuth code verifier');
});

it.each(['dynamic-client', 'another-client'])(
	'preserves dynamic client tokens only for their bound identity: %s',
	async (clientId) => {
		let stored: McpOAuthState = {
			client_id: 'dynamic-client',
			tokensClientId: 'dynamic-client',
			tokens: { access_token: 'access', token_type: 'Bearer' },
		};
		const provider = createOAuthProvider({
			storage: {
				load: () => stored,
				save: (value) => {
					stored = value;
				},
			},
		});
		expect(provider.clientInformation()).toEqual({ client_id: 'dynamic-client' });
		await provider.saveClientInformation!({ client_id: clientId });
		if (clientId === 'dynamic-client') {
			expect(provider.tokens()?.access_token).toBe('access');
			expect(stored.tokensClientId).toBe(clientId);
		} else {
			expect(provider.tokens()).toBeUndefined();
			expect(stored.tokensClientId).toBeUndefined();
		}
	}
);

it.each(['tokens', 'client', 'all', 'verifier'] as const)(
	'keeps token binding consistent when invalidating %s',
	async (scope) => {
		let stored: McpOAuthState = {
			client_id: 'client',
			tokensClientId: 'client',
			tokens: { access_token: 'access', token_type: 'Bearer' },
		};
		const provider = createOAuthProvider({
			storage: {
				load: () => stored,
				save: (value) => {
					stored = value;
				},
			},
		});
		await provider.invalidateCredentials!(scope);
		if (scope === 'verifier') {
			expect(stored.tokensClientId).toBe('client');
			expect(provider.tokens()?.access_token).toBe('access');
		} else {
			expect(stored.tokens).toBeUndefined();
			expect(stored.tokensClientId).toBeUndefined();
		}
	}
);
