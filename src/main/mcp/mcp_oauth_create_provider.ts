import { randomBytes } from 'node:crypto';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type { OAuthClientInformationMixed } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { McpOAuthProviderParams, McpOAuthState } from './mcp_types';
import { clientMetadata } from './mcp_oauth_client_metadata';
import { getMcpOAuthRedirectUrl } from './redirect';

export function createOAuthProvider(params: McpOAuthProviderParams): OAuthClientProvider {
	const { storage } = params;
	const state = params.state ?? randomBytes(32).toString('hex');
	const redirectUrl = getMcpOAuthRedirectUrl(params.redirectUrl);
	let discovery: Awaited<ReturnType<NonNullable<OAuthClientProvider['discoveryState']>>>;
	let codeVerifier: string | undefined;
	const { clientId, clientSecret } = params;
	const staticClient = clientId ? { client_id: clientId, client_secret: clientSecret } : undefined;
	return {
		get redirectUrl() {
			return redirectUrl;
		},
		state() {
			return state;
		},
		get clientMetadata() {
			return clientMetadata(
				Boolean(staticClient ? clientSecret : storage.load().client_secret),
				redirectUrl
			);
		},
		clientInformation() {
			const { tokens: _tokens, codeVerifier: _verifier, ...storedClient } = storage.load();
			const client = staticClient ?? storedClient;
			return client.client_id ? (client as OAuthClientInformationMixed) : undefined;
		},
		saveClientInformation(clientInformation) {
			storage.save({ ...storage.load(), ...clientInformation });
		},
		tokens() {
			return storage.load().tokens;
		},
		saveTokens(tokens) {
			const previous = storage.load();
			storage.save({
				...previous,
				tokens: {
					...tokens,
					refresh_token: tokens.refresh_token ?? previous.tokens?.refresh_token,
				},
			});
		},
		redirectToAuthorization(url) {
			for (const [key, value] of Object.entries(params.authorizationParams ?? {})) {
				url.searchParams.set(key, value);
			}
			if (!params.onRedirect) throw new Error('Connect this MCP server with OAuth in Settings.');
			params.onRedirect(url);
		},
		saveCodeVerifier(value) {
			codeVerifier = value;
		},
		codeVerifier() {
			const verifier = codeVerifier;
			if (!verifier) throw new Error('Missing OAuth code verifier. Start the login flow again.');
			return verifier;
		},
		discoveryState() {
			return discovery;
		},
		saveDiscoveryState(value) {
			discovery = value;
		},
		invalidateCredentials(scope) {
			const { tokens, codeVerifier: _storedVerifier, ...client } = storage.load();
			if (scope === 'all' || scope === 'verifier') codeVerifier = undefined;
			const next: McpOAuthState = scope === 'all' || scope === 'client' ? {} : client;
			if (scope !== 'all' && scope !== 'tokens') next.tokens = tokens;
			storage.save(next);
		},
	};
}
