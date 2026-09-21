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
			const {
				tokens: _tokens,
				tokensClientId: _tokensClientId,
				codeVerifier: _verifier,
				...storedClient
			} = storage.load();
			if (
				!staticClient &&
				params.onRedirect &&
				storedClient.redirect_uris &&
				!storedClient.redirect_uris.includes(redirectUrl)
			) {
				return undefined;
			}
			const client = staticClient ?? storedClient;
			return client.client_id ? (client as OAuthClientInformationMixed) : undefined;
		},
		saveClientInformation(clientInformation) {
			const previous = storage.load();
			storage.save({
				...clientInformation,
				...(previous.tokensClientId === clientInformation.client_id
					? { tokens: previous.tokens, tokensClientId: previous.tokensClientId }
					: {}),
			});
		},
		tokens() {
			const stored = storage.load();
			const currentClientId = staticClient?.client_id ?? stored.client_id;
			return currentClientId && stored.tokensClientId === currentClientId
				? stored.tokens
				: undefined;
		},
		saveTokens(tokens) {
			const previous = storage.load();
			const currentClientId = staticClient?.client_id ?? previous.client_id;
			storage.save({
				...previous,
				tokensClientId: currentClientId,
				tokens: {
					...tokens,
					refresh_token:
						tokens.refresh_token ??
						(!codeVerifier && currentClientId && previous.tokensClientId === currentClientId
							? previous.tokens?.refresh_token
							: undefined),
				},
			});
			codeVerifier = undefined;
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
			const { tokens, tokensClientId, codeVerifier: _storedVerifier, ...client } = storage.load();
			if (scope === 'all' || scope === 'verifier') codeVerifier = undefined;
			const next: McpOAuthState = scope === 'all' || scope === 'client' ? {} : client;
			if (scope === 'verifier') {
				next.tokens = tokens;
				next.tokensClientId = tokensClientId;
			}
			storage.save(next);
		},
	};
}
