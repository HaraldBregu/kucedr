import type { McpCallResult } from '../../../mcp';
import { MCP_MAX_OUTPUT_BYTES } from './limits';

export function mcpOutputText(result: McpCallResult): string {
	const content = result.content;
	const text = Array.isArray(content)
		? content
				.filter(
					(block): block is { text: string } =>
						typeof block === 'object' &&
						block !== null &&
						(block as { type?: unknown }).type === 'text' &&
						typeof (block as { text?: unknown }).text === 'string'
				)
				.map((block) => block.text)
				.join('\n') || JSON.stringify(content)
		: content === undefined
			? ''
			: JSON.stringify(content);
	const bytes = Buffer.from(text, 'utf8');
	if (bytes.length <= MCP_MAX_OUTPUT_BYTES) return text;
	const suffix = `\n[truncated: ${bytes.length - MCP_MAX_OUTPUT_BYTES} bytes omitted]`;
	const prefixBytes = Math.max(0, MCP_MAX_OUTPUT_BYTES - Buffer.byteLength(suffix, 'utf8'));
	const prefix = bytes.subarray(0, prefixBytes).toString('utf8').replace(/\uFFFD$/, '');
	return `${prefix}${suffix}`;
}
