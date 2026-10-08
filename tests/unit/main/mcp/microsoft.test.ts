import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import { loadMcps } from '../../../../src/main/models';
import { resolveMcpEndpoint } from '../../../../src/main/mcp/endpoint';
import { mcpOAuthOptions } from '../../../../src/main/mcp/oauth_options';
import { findMcpService } from '../../../../src/main/mcp/manifest';
import { parseMcpUrl } from '../../../../src/main/mcp/url';
import { createOAuthProvider } from '../../../../src/main/mcp/mcp_oauth_create_provider';
import type { McpOAuthState } from '../../../../src/main/mcp/mcp_types';

const tenantId = '11111111-1111-4111-8111-111111111111';
const template =
	'https://agent365.svc.cloud.microsoft/agents/tenants/{tenantId}/servers/mcp_MailTools';
const originalTenant = process.env.MICROSOFT_TENANT_ID;
const originalClient = process.env.MICROSOFT_CLIENT_ID;

beforeEach(() => {
	process.env.MICROSOFT_TENANT_ID = tenantId;
	process.env.MICROSOFT_CLIENT_ID = 'registered-microsoft-client';
});

afterEach(() => {
	if (originalTenant === undefined) delete process.env.MICROSOFT_TENANT_ID;
	else process.env.MICROSOFT_TENANT_ID = originalTenant;
	if (originalClient === undefined) delete process.env.MICROSOFT_CLIENT_ID;
	else process.env.MICROSOFT_CLIENT_ID = originalClient;
});

it('resolves all Microsoft 365 catalog endpoints and recognizes saved templates', () => {
	const services = loadMcps().filter(
		(entry) => entry.provider.id === 'microsoft' && entry.authentication === 'oauth2'
	);
	expect(services).toHaveLength(7);
	for (const service of services) {
		expect(service.url).toContain(`/tenants/${tenantId}/servers/`);
		expect(mcpOAuthOptions(service.url!)).toEqual({ clientId: 'registered-microsoft-client' });
	}
	expect(findMcpService(template)?.id).toBe('microsoft-mail');
	expect(parseMcpUrl(template).href).toBe(resolveMcpEndpoint(template));
});

it('reports missing configuration before connecting and leaves Learn available', () => {
	delete process.env.MICROSOFT_TENANT_ID;
	delete process.env.MICROSOFT_CLIENT_ID;
	expect(loadMcps().find((entry) => entry.id === 'microsoft-mail')?.url).toBe(template);
	expect(() => parseMcpUrl(template)).toThrow('MICROSOFT_TENANT_ID');
	expect(() => mcpOAuthOptions(template)).toThrow('MICROSOFT_TENANT_ID');
	expect(mcpOAuthOptions('https://learn.microsoft.com/api/mcp')).toEqual({});
	process.env.MICROSOFT_TENANT_ID = tenantId;
	expect(() => mcpOAuthOptions(template)).toThrow('MICROSOFT_CLIENT_ID');
});

it.each(['common', '../other', '00000000-0000-0000-0000-000000000000'])(
	'rejects invalid tenant IDs: %s',
	(value) => {
		process.env.MICROSOFT_TENANT_ID = value;
		expect(() => parseMcpUrl(template)).toThrow('nonzero Microsoft Entra');
	}
);

it('does not rewrite unrelated endpoints or send credentials to another origin', () => {
	const url = template.replace(
		'agent365.svc.cloud.microsoft',
		'agent365.svc.cloud.microsoft.evil.test'
	);
	expect(resolveMcpEndpoint(url, true)).toBe(url);
	expect(mcpOAuthOptions(url)).toEqual({});
	expect(
		findMcpService(resolveMcpEndpoint(template).replace('mcp_MailTools', 'unknown'))
	).toBeUndefined();
});

it('uses discovered Microsoft scopes, PKCE, and refresh tokens without a client secret or DCR', async () => {
	const serverUrl = resolveMcpEndpoint(template, true);
	const issuer = 'https://login.microsoftonline.com/organizations/v2.0';
	const tokenUrl = 'https://login.microsoftonline.com/organizations/oauth2/v2.0/token';
	const scopes = `${serverUrl}/.default openid profile offline_access`;
	let stored: McpOAuthState = { client_id: 'old-client', client_secret: 'old-secret' };
	const redirect = jest.fn();
	const provider = createOAuthProvider({
		...mcpOAuthOptions(serverUrl),
		storage: {
			load: () => stored,
			save: (value) => {
				stored = value;
			},
		},
		onRedirect: redirect,
	});
	const fetchFn = jest.fn(async (input: string | URL, init?: RequestInit) => {
		const url = String(input);
		if (url.includes('/.well-known/oauth-protected-resource'))
			return Response.json({
				resource: serverUrl,
				authorization_servers: [issuer],
				scopes_supported: scopes.split(' '),
			});
		if (url.includes('/.well-known/'))
			return Response.json({
				issuer,
				authorization_endpoint:
					'https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize',
				token_endpoint: tokenUrl,
				response_types_supported: ['code'],
				code_challenge_methods_supported: ['S256'],
				token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
			});
		if (url === tokenUrl) {
			const body = new URLSearchParams(String(init?.body));
			expect(body.get('client_id')).toBe('registered-microsoft-client');
			expect(body.has('client_secret')).toBe(false);
			if (body.get('grant_type') === 'authorization_code') {
				expect(body.get('code_verifier')).toBe(await provider.codeVerifier());
				expect(body.get('redirect_uri')).toBe(provider.redirectUrl);
				return Response.json({
					access_token: 'access',
					token_type: 'Bearer',
					refresh_token: 'refresh',
				});
			}
			expect(body.get('grant_type')).toBe('refresh_token');
			expect(body.get('refresh_token')).toBe('refresh');
			return Response.json({ access_token: 'renewed', token_type: 'Bearer' });
		}
		throw new Error(`Unexpected request: ${url}`);
	});
	await expect(auth(provider, { serverUrl, fetchFn })).resolves.toBe('REDIRECT');
	const url = redirect.mock.calls[0][0] as URL;
	expect(url.searchParams.get('scope')).toBe(scopes);
	expect(url.searchParams.get('client_id')).toBe('registered-microsoft-client');
	expect(url.searchParams.get('code_challenge_method')).toBe('S256');
	expect(url.searchParams.get('state')).toBe(await provider.state!());
	await expect(auth(provider, { serverUrl, fetchFn, authorizationCode: 'code' })).resolves.toBe(
		'AUTHORIZED'
	);
	await expect(auth(provider, { serverUrl, fetchFn })).resolves.toBe('AUTHORIZED');
	expect(stored.tokens?.access_token).toBe('renewed');
	expect(stored.tokens?.refresh_token).toBe('refresh');
});
