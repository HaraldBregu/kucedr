import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { PLUGIN_KINDS, type PluginKind } from '../../shared/plugin_types';
import { mcpServersFileIds } from './plugins_mcp_file_ids';

/** Contribution ids per kind: the folders under `<kind>/`, plus the keys of `mcp/servers.json`. Providers come from the manifest. */
export function pluginContents(directory: string): Record<PluginKind, string[]> {
	return Object.fromEntries(
		PLUGIN_KINDS.map((kind) => {
			const kindDirectory = path.join(directory, kind);
			if (kind === 'providers' || !existsSync(kindDirectory)) return [kind, []];
			const ids: string[] = [];
			for (const entry of readdirSync(kindDirectory, { withFileTypes: true })) {
				if (entry.name.startsWith('.')) continue;
				if (kind === 'mcp' && entry.name === 'servers.json' && entry.isFile()) continue;
				if (!entry.isDirectory()) throw new Error(`${kind}/${entry.name} must be a folder.`);
				ids.push(entry.name);
			}
			if (kind === 'mcp') {
				for (const id of mcpServersFileIds(kindDirectory)) {
					if (ids.includes(id)) {
						throw new Error(`mcp/${id} is both a folder and a servers.json entry.`);
					}
					ids.push(id);
				}
			}
			return [kind, ids.sort()];
		})
	) as Record<PluginKind, string[]>;
}
