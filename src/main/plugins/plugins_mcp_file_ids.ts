import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Server ids in `mcp/servers.json`; the file's contents are validated by the MCP loader. */
export function mcpServersFileIds(directory: string): string[] {
	const file = path.join(directory, 'servers.json');
	if (!existsSync(file)) return [];
	let value: unknown;
	try {
		value = JSON.parse(readFileSync(file, 'utf8'));
	} catch (error) {
		throw new Error('mcp/servers.json is not valid JSON.', { cause: error });
	}
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('mcp/servers.json must map server ids to server configs.');
	}
	return Object.keys(value);
}
