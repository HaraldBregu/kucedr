import type { McpCallResult } from '../../../mcp';
import { MCP_MAX_OUTPUT_BYTES } from './limits';

export function mcpOutputText(result: McpCallResult): string {
	const content = result.content;
	const text =
		(Array.isArray(content) ? content : content === undefined ? [] : [content])
			.map((block: unknown) =>
				typeof block === 'object' &&
				block !== null &&
				(block as { type?: unknown }).type === 'text' &&
				typeof (block as { text?: unknown }).text === 'string'
					? (block as { text: string }).text
					: JSON.stringify(block, (key, value: unknown) =>
							(key === 'data' || key === 'blob') && typeof value === 'string'
								? `[${value.length} base64 characters omitted]`
								: value
						)
			)
			.join('\n') ||
		(result.structuredContent === undefined ? '' : JSON.stringify(result.structuredContent));
	const bytes = Buffer.from(text, 'utf8');
	if (bytes.length <= MCP_MAX_OUTPUT_BYTES) return text;
	const suffix = `\n[truncated: ${bytes.length - MCP_MAX_OUTPUT_BYTES} bytes omitted]`;
	const prefixBytes = Math.max(0, MCP_MAX_OUTPUT_BYTES - Buffer.byteLength(suffix, 'utf8'));
	const prefix = bytes.subarray(0, prefixBytes).toString('utf8').replace(/\uFFFD$/, '');
	return `${prefix}${suffix}`;
}
