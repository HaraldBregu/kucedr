import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { McpServerInfo } from '../../shared/mcp_types';
import { parseLocalMcpServer } from './mcp_local_parse';

export function readLocalMcpServer(directory: string): McpServerInfo {
	const manifestPath = path.join(directory, 'mcp.json');
	let value: unknown;
	try {
		value = JSON.parse(readFileSync(manifestPath, 'utf8'));
	} catch (error) {
		throw new Error(
			error instanceof SyntaxError
				? 'mcp.json is not valid JSON.'
				: 'Missing readable mcp.json manifest.',
			{ cause: error }
		);
	}
	return parseLocalMcpServer(value, directory, path.basename(directory), 'mcp.json');
}
