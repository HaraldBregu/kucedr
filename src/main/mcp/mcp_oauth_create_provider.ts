import { randomBytes } from 'node:crypto';
import { googleMcpScopes } from '../../shared/google_mcp';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type { OAuthClientInformationMixed } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { McpOAuthProviderParams, McpOAuthState } from './mcp_types';
import { clientMetadata } from './mcp_oauth_client_metadata';
import { getMcpOAuthRedirectUrl } from './redirect';

export function createOAuthProvider(params: McpOAuthProviderParams): OAuthClientProvider {
	const { storage } = params;
	const state = randomBytes(32).toString('hex');
	const redirectUrl = getMcpOAuthRedirectUrl();
	let codeVerifier: string | undefined;
	const googleScopes = googleMcpScopes(params.serverUrl ?? '');
	const clientId = googleScopes ? process.env.MCP_GOOGLE_CLIENT_ID?.trim() : params.clientId;
	const clientSecret = googleScopes
		? process.env.MCP_GOOGLE_CLIENT_SECRET?.trim()
		: params.clientSecret;
	const staticClient =
		googleScopes || clientId ? { client_id: clientId, client_secret: clientSecret } : undefined;
	return {
		get redirectUrl() {
			return redirectUrl;
		},
		state() {
			return state;
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
		saveCodeVerifier(value) {
			codeVerifier = value;
		},
		codeVerifier() {
			const verifier = codeVerifier;
			if (!verifier) throw new Error('Missing OAuth code verifier. Start the login flow again.');
			return verifier;
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
