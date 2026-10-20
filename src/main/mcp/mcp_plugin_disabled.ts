import type { McpServerInfo } from '../../shared/mcp_types';
import { pluginOwner } from '../plugins/plugins_owner';

/** Servers read from a plugin folder start disabled; enabling one saves the user's own copy. */
export function pluginServerDisabled(server: McpServerInfo): McpServerInfo {
	const plugin = server.path ? pluginOwner(server.path) : undefined;
	return plugin ? { ...server, plugin, data: { ...server.data, enabled: false } } : server;
}
