import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { PLUGIN_KINDS, type PluginKind } from '../../shared/plugin_types';
import { mcpServersFileIds } from './plugins_mcp_file_ids';

/** Contribution ids per kind: the folders under `<kind>/`, plus the keys of `mcp/servers.json`. */
export function pluginContents(directory: string): Record<PluginKind, string[]> {
	const contents = Object.fromEntries(
		PLUGIN_KINDS.map((kind) => {
			const kindDirectory = path.join(directory, kind);
			if (!existsSync(kindDirectory)) return [kind, []];
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
	if (Object.values(contents).every((ids) => ids.length === 0)) {
		throw new Error(
			'A plugin must contain at least one app, extension, MCP server, provider, or skill.'
		);
	}
	return contents;
}
