import { createHash } from 'node:crypto';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export function mcpToolHash(tool: Tool): string {
	return createHash('sha256')
		.update(JSON.stringify([tool.name, tool.description, tool.inputSchema, tool.annotations]))
		.digest('hex');
}
