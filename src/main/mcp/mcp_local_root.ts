import path from 'node:path';
import { userDataLocation } from '../shared/user_data_location';
import { pluginDirs } from '../plugins/plugins_dirs';

export function mcpLocalRoot(location = userDataLocation()): string {
	return path.resolve(location, 'mcp', 'servers');
}

export function mcpLocalDiscoveryRoots(location = userDataLocation()): readonly string[] {
	const localRoot = mcpLocalRoot(location);
	const workspaceRoot = path.resolve(process.cwd(), 'resources', 'mcp');
	const pluginRoots = pluginDirs('mcp_servers').map((entry) => entry.directory);
	return localRoot === workspaceRoot
		? [localRoot, ...pluginRoots]
		: [localRoot, ...pluginRoots, workspaceRoot];
}
