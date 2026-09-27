import { listTools, type McpClient } from '../../../mcp';

export async function listMcpCatalog(client: McpClient, signal?: AbortSignal) {
	const tools: Awaited<ReturnType<typeof listTools>>['tools'] = [];
	const cursors = new Set<string>();
	let cursor: string | undefined;
	do {
		const page = await listTools(client, 30_000, signal, cursor);
		tools.push(...page.tools);
		cursor = page.nextCursor;
		if (cursor && cursors.has(cursor)) throw new Error('MCP tools/list repeated a cursor.');
		if (cursor) cursors.add(cursor);
	} while (cursor);
	return tools;
}
