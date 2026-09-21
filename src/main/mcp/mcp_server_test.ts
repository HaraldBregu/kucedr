import type { McpTestResult } from '../../shared/mcp_types';
import { close } from './mcp_client_close';
import { connect } from './mcp_client_connect';
import { listTools } from './mcp_client_list_tools';
import { getMcpServers } from './mcp_store';
import type { McpClient } from './mcp_types';

export async function testMcpServer(id: string): Promise<McpTestResult> {
	const started = Date.now();
	const data = getMcpServers()[id];
	if (!data) {
		return { ok: false, tools: [], toolCount: 0, durationMs: 0, error: `No MCP server "${id}".` };
	}
	let client: McpClient | undefined;
	try {
		client = await connect(id, data, 15_000);
		const result = await listTools(client, 15_000);
		const toolDetails = result.tools
			.map((tool) => ({ name: tool.name, description: tool.description }))
			.sort((a, b) => a.name.localeCompare(b.name));
		return {
			ok: true,
			tools: toolDetails.map((tool) => tool.name),
			toolDetails,
			toolCount: toolDetails.length,
			durationMs: Date.now() - started,
		};
	} catch (error) {
		return {
			ok: false,
			tools: [],
			toolCount: 0,
			durationMs: Date.now() - started,
			error: error instanceof Error ? error.message : String(error),
		};
	} finally {
		if (client) await close(client).catch(() => {});
	}
}
