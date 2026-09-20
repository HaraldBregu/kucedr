import { googleMcpScopes } from '../../shared/google_mcp';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type { OAuthClientInformationMixed } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { McpOAuthProviderParams, McpOAuthState } from './mcp_types';
import { clientMetadata } from './mcp_oauth_client_metadata';
import { getMcpOAuthRedirectUrl } from './redirect';

export function createOAuthProvider(params: McpOAuthProviderParams): OAuthClientProvider {
	const { storage } = params;
	const googleScopes = googleMcpScopes(params.serverUrl ?? '');
	const clientId = googleScopes ? process.env.MCP_GOOGLE_CLIENT_ID?.trim() : params.clientId;
	const clientSecret = googleScopes
		? process.env.MCP_GOOGLE_CLIENT_SECRET?.trim()
		: params.clientSecret;
	const staticClient =
		googleScopes || clientId ? { client_id: clientId, client_secret: clientSecret } : undefined;
	return {
		get redirectUrl() {
			return getMcpOAuthRedirectUrl();
		},
		get clientMetadata() {
			return clientMetadata(
				Boolean(googleScopes ? clientSecret : (clientSecret ?? storage.load().client_secret))
			);
		},
		clientInformation() {
			const { tokens: _tokens, codeVerifier: _verifier, ...storedClient } = storage.load();
			const client = staticClient ?? storedClient;
			if (googleScopes && (!client.client_id || !client.client_secret)) {
				throw new Error(
					`Set MCP_GOOGLE_CLIENT_ID and MCP_GOOGLE_CLIENT_SECRET in the .env file. Register ${getMcpOAuthRedirectUrl()} as the OAuth client redirect URI in Google Cloud. Google does not support dynamic client registration.`
				);
			}
			return client.client_id ? (client as OAuthClientInformationMixed) : undefined;
		},
		saveClientInformation(clientInformation) {
			storage.save({ ...storage.load(), ...clientInformation });
		},
		tokens() {
			return storage.load().tokens;
		},
		saveTokens(tokens) {
			storage.save({ ...storage.load(), tokens });
		},
		redirectToAuthorization(url) {
			if (googleScopes) {
				url.searchParams.set('scope', googleScopes);
				url.searchParams.set('access_type', 'offline');
				url.searchParams.set('prompt', 'consent');
			}
			params.onRedirect?.(url);
		},
		saveCodeVerifier(codeVerifier) {
			storage.save({ ...storage.load(), codeVerifier });
		},
		codeVerifier() {
			const verifier = storage.load().codeVerifier;
			if (!verifier) throw new Error('Missing OAuth code verifier. Start the login flow again.');
			return verifier;
		},
		invalidateCredentials(scope) {
			const { tokens, codeVerifier, ...client } = storage.load();
			const next: McpOAuthState = scope === 'all' || scope === 'client' ? {} : client;
			if (scope !== 'all' && scope !== 'tokens') next.tokens = tokens;
			if (scope !== 'all' && scope !== 'verifier') next.codeVerifier = codeVerifier;
			storage.save(next);
		},
	};
}
