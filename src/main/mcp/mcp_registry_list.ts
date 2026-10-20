import type { McpRegistry, McpServerInfo } from '../../shared/mcp_types';
import { listConfiguredMcpServers } from './mcp_configured_list';
import { listLocalMcpServers } from './mcp_local_list';
import { mcpServerRoots } from './mcp_server_roots';
import { pluginServerDisabled } from './mcp_plugin_disabled';

export function listMcpRegistry(): McpRegistry {
	const local = listLocalMcpServers(mcpServerRoots());
	const configured = new Map<string, McpServerInfo>();
	for (const [id, data] of Object.entries(listConfiguredMcpServers())) {
		configured.set(id, { id, source: 'configured', data });
	}
	for (const server of local.servers) {
		const collision = configured.get(server.id);
		if (collision) {
			configured.set(server.id, {
				...collision,
				diagnostic: `Local server at ${server.path ?? server.id} is ignored because a configured server uses the same ID.`,
			});
			continue;
		}
		configured.set(server.id, pluginServerDisabled(server));
	}
	return {
		servers: [...configured.values()].sort((a, b) => a.id.localeCompare(b.id)),
		diagnostics: local.diagnostics,
	};
}
