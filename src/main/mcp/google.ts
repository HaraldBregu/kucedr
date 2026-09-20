import { googleMcpScopes } from '../../shared/google_mcp';
import type { McpOAuthProviderParams } from './mcp_types';

export function googleOAuthOptions(serverUrl: string): Partial<McpOAuthProviderParams> {
	const scope = googleMcpScopes(serverUrl);
	if (!scope) return {};
	const clientId = process.env.MCP_GOOGLE_CLIENT_ID?.trim();
	const clientSecret = process.env.MCP_GOOGLE_CLIENT_SECRET?.trim();
	if (!clientId) {
		throw new Error(
			'Set MCP_GOOGLE_CLIENT_ID for your registered Google OAuth client. Set MCP_GOOGLE_CLIENT_SECRET if required by that client.'
		);
	}
	return {
		clientId,
		clientSecret,
		authorizationParams: { scope, access_type: 'offline', prompt: 'consent' },
	};
}
