import { findMcpService } from './manifest';
import type { McpOAuthProviderParams } from './mcp_types';

export function mcpOAuthOptions(serverUrl: string): Partial<McpOAuthProviderParams> {
	const service = findMcpService(serverUrl);
	if (!service) return {};
	const oauth = service.oauth;
	const clientId = oauth?.client_id_env ? process.env[oauth.client_id_env]?.trim() : undefined;
	const clientSecret = oauth?.client_secret_env
		? process.env[oauth.client_secret_env]?.trim()
		: undefined;
	if ((oauth?.client_id_env && !clientId) || (oauth?.client_secret_env && !clientSecret)) {
		throw new Error(
			`Set ${[oauth.client_id_env, oauth.client_secret_env].filter(Boolean).join(' and ')} in the environment before connecting this MCP server.`
		);
	}
	const scope = service.scopes?.join(' ');
	return {
		...(clientId ? { clientId } : {}),
		...(clientSecret ? { clientSecret } : {}),
		...(scope || oauth?.authorization_params
			? { authorizationParams: { ...oauth?.authorization_params, ...(scope ? { scope } : {}) } }
			: {}),
	};
}
