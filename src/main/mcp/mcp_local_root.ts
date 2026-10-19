import path from 'node:path';
import { userDataLocation } from '../shared/user_data_location';
import { pluginDirs } from '../plugins/plugins_dirs';

export function mcpLocalRoot(location = userDataLocation()): string {
	return path.resolve(location, 'mcp', 'servers');
}

export function mcpLocalDiscoveryRoots(location = userDataLocation()): readonly string[] {
	return [mcpLocalRoot(location), ...pluginDirs('mcp').map((entry) => entry.directory)];
}
