import { callTool, type McpCallResult, type McpClient } from '../../../mcp';
import { getMcpServers } from '../../../mcp';
import { findMcpService } from '../../../mcp/manifest';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { jsonTool } from '../tool';
import type { JSONSchema } from '../../types';
import type { McpApprovalPolicy } from '../../../../shared/mcp_types';
import { MCP_MAX_OUTPUT_BYTES, MCP_TOOL_TIMEOUT_MS } from './limits';
import { mcpToolName } from './name';
import { mcpOutputText } from './output';
import { mcpInputParser } from './schema';

export function mcpTool(
	client: McpClient | (() => Promise<McpClient>),
	toolName: string,
	description: string,
	schema: JSONSchema,
	serverId: string,
	approval?: McpApprovalPolicy,
	runtimeName = mcpToolName(serverId, toolName, new Set()),
	readOnly = false,
	resetConnection?: () => Promise<void>
) {
	const parseInput = mcpInputParser(schema);
	return jsonTool({
		id: runtimeName,
		name: toolName.charAt(0).toUpperCase() + toolName.slice(1).replaceAll('_', ' '),
		description,
		policy: { kind: 'mcp', serverId, toolName },
		capability: {
			effects: readOnly ? ['read'] : ['external'],
			approval: approval === 'always' || (approval !== 'never' && !readOnly),
		},
		timeoutMs: MCP_TOOL_TIMEOUT_MS,
		maxOutputBytes: MCP_MAX_OUTPUT_BYTES,
		parseInput,
		schema,
		execute: async (input, signal) => {
			try {
				const connected = typeof client === 'function' ? await client() : client;
				const result = (await callTool(
					connected,
					toolName,
					input,
					MCP_TOOL_TIMEOUT_MS,
					signal
				)) as McpCallResult;
				const text = mcpOutputText(result);
				if (result.isError) throw new Error(text || `MCP tool ${toolName} failed.`);
				return text;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (
					error instanceof UnauthorizedError ||
					/unauthori[sz]ed|\b401\b|authentication required|insufficient_scope|Connect this MCP server with OAuth in Settings\./i.test(message)
				) {
					const server = getMcpServers()[serverId];
					if (
						server?.type === 'http' &&
						!server.token &&
						(!findMcpService(server.url)?.oauth?.credentials_required || server.client_id)
					) {
						await resetConnection?.();
						return {
							status: 'authorization_required',
							serverId,
							serverName: server.name?.trim() || serverId,
						};
					}
				}
				throw error;
			}
		},
	});
}
