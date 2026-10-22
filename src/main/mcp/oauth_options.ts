import { resolveMcpEndpoint } from './endpoint';
import { findMcpService } from './manifest';
import type { McpOAuthProviderParams } from './mcp_types';
import { pluginSettings } from '../plugins/plugins_settings';

export function mcpOAuthOptions(serverUrl: string): Partial<McpOAuthProviderParams> {
	const service = findMcpService(resolveMcpEndpoint(serverUrl, true));
	if (!service) return {};
	const oauth = service.oauth;
	const settings = pluginSettings(service.provider.id);
	const clientId = oauth?.client_id_setting ? settings[oauth.client_id_setting] : undefined;
	const clientSecret = oauth?.client_secret_setting
		? settings[oauth.client_secret_setting]
		: undefined;
	if ((oauth?.client_id_setting && !clientId) || (oauth?.client_secret_setting && !clientSecret)) {
		const labels = (service.provider.settings ?? [])
			.filter((setting) =>
				[oauth.client_id_setting, oauth.client_secret_setting].includes(setting.key)
			)
			.map((setting) => setting.label);
		throw new Error(
			`Set ${labels.join(' and ')} in the ${service.provider.name} plugin settings before connecting this MCP server.`
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
