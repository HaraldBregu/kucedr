import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { McpServerInfo } from '../../shared/mcp_types';
import { parseLocalMcpServer } from './mcp_local_parse';

export interface McpServerEntry {
	readonly name: string;
	readonly path: string;
	readonly read: () => McpServerInfo;
}

/** Entries of `<root>/servers.json`, an object of server configs keyed by server id. */
export function mcpServersFileEntries(root: string): McpServerEntry[] {
	const file = path.join(root, 'servers.json');
	if (!existsSync(file)) return [];
	const failed = (message: string): McpServerEntry[] => [
		{
			name: 'servers.json',
			path: file,
			read: () => {
				throw new Error(message);
			},
		},
	];
	let value: unknown;
	try {
		value = JSON.parse(readFileSync(file, 'utf8'));
	} catch {
		return failed('servers.json is not valid JSON.');
	}
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return failed('servers.json must map server ids to server configs.');
	}
	return Object.entries(value).map(([id, entry]) => ({
		name: id,
		path: file,
		read: () =>
			parseLocalMcpServer(
				entry && typeof entry === 'object' ? { ...entry, id } : entry,
				root,
				id,
				`servers.json "${id}"`,
				true
			),
	}));
}
