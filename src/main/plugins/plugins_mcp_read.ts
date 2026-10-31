import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Reads `mcp/<id>/manifest.json`: the remote MCP servers a provider plugin offers. Local servers use `mcp.json`. */
export function readPluginMcpServers(directory: string): { mcp_servers?: unknown[] } {
	const mcpDirectory = path.join(directory, 'mcp');
	if (!existsSync(mcpDirectory)) return {};
	const mcp_servers: unknown[] = [];
	for (const entry of readdirSync(mcpDirectory, { withFileTypes: true })) {
		const file = path.join(mcpDirectory, entry.name, 'manifest.json');
		if (!entry.isDirectory() || !existsSync(file)) continue;
		let value: { id?: unknown };
		try {
			value = JSON.parse(readFileSync(file, 'utf8'));
		} catch (error) {
			throw new Error(`mcp/${entry.name}/manifest.json is not valid JSON.`, { cause: error });
		}
		if (value?.id !== entry.name) {
			throw new Error(`mcp/${entry.name}/manifest.json must have id "${entry.name}".`);
		}
		mcp_servers.push(value);
	}
	return mcp_servers.length ? { mcp_servers } : {};
}
