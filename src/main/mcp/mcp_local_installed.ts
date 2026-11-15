import type { McpServerInfo } from '../../shared/mcp_types';

export function installedLocalServer(
	server: McpServerInfo,
	installed: ReadonlySet<string>
): McpServerInfo {
	return installed.has(server.id) ? server : { ...server, data: { ...server.data, enabled: false } };
}
