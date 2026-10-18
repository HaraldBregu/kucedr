import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { McpToolDetail } from '../../shared/mcp_types';
import { getMcpToolPermission } from './mcp_tool_permission';

export function mcpToolDetails(id: string, tools: Tool[]): McpToolDetail[] {
	return tools
		.map((tool) => ({
			name: tool.name,
			description: tool.description,
			permission: getMcpToolPermission(id, tool.name),
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}
