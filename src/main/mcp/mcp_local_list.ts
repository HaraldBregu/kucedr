import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { McpRegistry } from '../../shared/mcp_types';
import { readLocalMcpServer } from './mcp_local_read';
import { mcpLocalDiscoveryRoots } from './mcp_local_root';
import { mcpServersFileEntries, type McpServerEntry } from './mcp_servers_file_entries';

export function listLocalMcpServers(
	roots: string | readonly string[] = mcpLocalDiscoveryRoots()
): McpRegistry {
	const searchRoots = Array.isArray(roots) ? [...roots] : [roots];
	const servers: McpRegistry['servers'][number][] = [];
	const sourceIds = new Set<string>();
	const diagnostics: McpRegistry['diagnostics'][number][] = [];
	const rootSeen = new Set<string>();

	for (const root of searchRoots) {
		const normalizedRoot = path.resolve(root);
		if (rootSeen.has(normalizedRoot)) continue;
		rootSeen.add(normalizedRoot);
		if (!existsSync(normalizedRoot)) continue;
		const rootSourceIds = new Set<string>();
		const entries: McpServerEntry[] = [
			...readdirSync(normalizedRoot, { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((entry) => {
					const directory = path.join(normalizedRoot, entry.name);
					return { name: entry.name, path: directory, read: () => readLocalMcpServer(directory) };
				}),
			...mcpServersFileEntries(normalizedRoot),
		];
		for (const entry of entries) {
			try {
				const server = entry.read();
				if (rootSourceIds.has(server.id)) {
					throw new Error(`Another local MCP server already uses ID "${server.id}".`);
				}
				rootSourceIds.add(server.id);
				if (sourceIds.has(server.id)) continue;

				sourceIds.add(server.id);
				servers.push(server);
			} catch (error) {
				diagnostics.push({
					name: entry.name,
					path: entry.path,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
	}
	return { servers, diagnostics };
}
