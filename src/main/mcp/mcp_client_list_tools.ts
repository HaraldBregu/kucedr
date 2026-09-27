import type { McpClient, McpListToolsResult } from './mcp_types';

export function listTools(
	client: McpClient,
	timeout?: number,
	signal?: AbortSignal,
	cursor?: string
): McpListToolsResult {
	return client.listTools(cursor ? { cursor } : undefined, timeout === undefined ? undefined : { timeout, signal });
}
