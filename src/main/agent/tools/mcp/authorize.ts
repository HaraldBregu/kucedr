import { z } from 'zod';
import { getMcpServers, testMcpServer } from '../../../mcp';
import { findMcpService } from '../../../mcp/manifest';
import { tool } from '../tool';

export function requestMcpAuthorizationTool() {
	const servers = Object.entries(getMcpServers())
		.filter(([, data]) => data.type === 'http' && data.enabled !== false && (!findMcpService(data.url)?.oauth?.credentials_required || Boolean(data.client_id)))
		.map(([id, data]) => `${id}${data.name ? ` (${data.name})` : ''}`);
	return tool({
		id: 'request_mcp_authorization',
		name: 'Request MCP authorization',
		description: `Show an in-chat OAuth authorization button when a configured remote MCP server needs authorization. Do not open the authorization URL yourself. Available servers: ${servers.join(', ') || 'none'}.`,
		capability: { effects: ['read'] },
		inputSchema: z.object({ serverId: z.string().min(1).describe('Configured MCP server ID to authorize.') }),
		execute: async ({ serverId }) => {
			const server = getMcpServers()[serverId];
			if (!server || server.type !== 'http' || server.enabled === false)
				throw new Error(`No enabled remote MCP server "${serverId}".`);
			if (findMcpService(server.url)?.oauth?.credentials_required && !server.client_id)
				throw new Error(`${serverId} requires a personal access token in MCP Settings.`);
			const result = await testMcpServer(serverId);
			if (result.ok) return { status: 'connected' as const, serverId, serverName: server.name?.trim() || serverId };
			if (!/unauthori[sz]ed|\b401\b|insufficient_scope|Connect this MCP server with OAuth in Settings\./i.test(result.error ?? ''))
				throw new Error(result.error ?? `Could not connect to ${serverId}.`);
			return {
				status: 'authorization_required' as const,
				serverId,
				serverName: server.name?.trim() || serverId,
				message: 'Wait for the user to authorize this server from the chat card before using its tools.',
			};
		},
	});
}
