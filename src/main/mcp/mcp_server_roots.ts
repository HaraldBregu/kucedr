import { pluginDirs } from '../plugins/plugins_dirs';
import { mcpLocalRoot } from './mcp_local_root';

/** Folders whose child folders are local MCP servers: the user's own, then enabled plugins'. */
export function mcpServerRoots(): string[] {
	return [mcpLocalRoot(), ...pluginDirs('mcp_servers').map((entry) => entry.directory)];
}
