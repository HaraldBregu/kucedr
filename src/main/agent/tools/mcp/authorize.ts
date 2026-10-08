import { z } from 'zod';
import { getMcpServers } from '../../../mcp';
import { tool } from '../tool';

export function requestMcpAuthorizationTool() {
	const servers = Object.entries(getMcpServers())
		.filter(([, data]) => data.type === 'http' && data.enabled !== false)
		.map(([id, data]) => `${id}${data.name ? ` (${data.name})` : ''}`);
	return tool({
		id: 'request_mcp_authorization',
		name: 'Request MCP authorization',
		description: `Show an in-chat OAuth authorization button when a configured remote MCP server needs authorization. Do not open the authorization URL yourself. Available servers: ${servers.join(', ') || 'none'}.`,
		capability: { effects: ['read'] },
		inputSchema: z.object({ serverId: z.string().min(1).describe('Configured MCP server ID to authorize.') }),
		execute: ({ serverId }) => {
			const server = getMcpServers()[serverId];
			if (!server || server.type !== 'http' || server.enabled === false)
				throw new Error(`No enabled remote MCP server "${serverId}".`);
			return {
				status: 'authorization_required' as const,
				serverId,
				serverName: server.name?.trim() || serverId,
			};
		},
	});
}
