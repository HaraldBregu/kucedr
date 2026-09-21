import { googleMcpScopes } from '../../shared/google_mcp';
import type { McpOAuthProviderParams, McpOAuthState } from './mcp_types';

export function googleOAuthOptions(
	serverUrl: string,
	credentials: Pick<McpOAuthState, 'client_id' | 'client_secret'> = {}
): Partial<McpOAuthProviderParams> {
	const scope = googleMcpScopes(serverUrl);
	if (!scope) return {};
	const configuredId = credentials.client_id?.trim();
	const clientId = configuredId || process.env.GOOGLE_CLIENT_ID?.trim();
	const clientSecret =
		(configuredId ? credentials.client_secret : process.env.GOOGLE_CLIENT_SECRET)?.trim() ||
		undefined;
	if (!clientId) {
		throw new Error(
			'Enter the Google OAuth Client ID and optional Client secret in this MCP server’s settings. GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are optional environment defaults.'
		);
	}
	return {
		clientId,
		clientSecret,
		authorizationParams: { scope, access_type: 'offline', prompt: 'consent' },
	};
}
