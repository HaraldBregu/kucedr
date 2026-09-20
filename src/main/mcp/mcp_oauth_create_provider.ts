import { googleMcpScopes } from '../../shared/google_mcp';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type { OAuthClientInformationMixed } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { McpOAuthProviderParams, McpOAuthState } from './mcp_types';
import { clientMetadata, MCP_OAUTH_REDIRECT_URL } from './mcp_oauth_client_metadata';

export function createOAuthProvider(params: McpOAuthProviderParams): OAuthClientProvider {
	const { storage } = params;
	const googleScopes = googleMcpScopes(params.serverUrl ?? '');
	const staticClient = params.clientId
		? { client_id: params.clientId, client_secret: params.clientSecret }
		: undefined;
	return {
		get redirectUrl() {
			return MCP_OAUTH_REDIRECT_URL;
		},
		get clientMetadata() {
			return clientMetadata(Boolean(params.clientSecret ?? storage.load().client_secret));
		},
		clientInformation() {
			const { tokens: _tokens, codeVerifier: _verifier, ...storedClient } = storage.load();
			const client = staticClient ?? storedClient;
			if (googleScopes && (!client.client_id || !client.client_secret)) {
				throw new Error(
					`Google MCP requires a Google Cloud OAuth client ID and client secret. Create a Web application client, register ${MCP_OAUTH_REDIRECT_URL} as its authorized redirect URI, and enter the credentials in the server settings. Google does not support dynamic client registration.`
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
