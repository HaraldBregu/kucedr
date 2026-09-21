import { googleMcpScopes } from '../../shared/google_mcp';
import type { McpOAuthProviderParams } from './mcp_types';

export function googleOAuthOptions(serverUrl: string): Partial<McpOAuthProviderParams> {
	const scope = googleMcpScopes(serverUrl);
	if (!scope) return {};
	const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
	const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
	if (!clientId || !clientSecret) {
		throw new Error(
			'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the environment before connecting a Google MCP server.'
		);
	}
	return {
		clientId,
		clientSecret,
		authorizationParams: { scope, access_type: 'offline', prompt: 'consent select_account' },
	};
}
