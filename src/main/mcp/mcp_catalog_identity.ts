import { createHash } from 'node:crypto';
import type { McpData } from '../../shared/mcp_types';

export function mcpCatalogIdentity(data: McpData): string {
	const connection =
		data.type === 'http'
			? { type: data.type, url: data.url, token: data.token, client_id: data.client_id, client_secret: data.client_secret }
			: { type: data.type, command: data.command, args: data.args, cwd: data.cwd, env: data.env };
	return createHash('sha256').update(JSON.stringify(connection)).digest('hex');
}
