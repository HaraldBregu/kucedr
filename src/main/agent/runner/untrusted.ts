import type { Tool } from '../types';

export const UNTRUSTED_TAG = 'untrusted_content';

export function untrusted(tool: Tool | undefined, text: string): string {
	if (!tool || (tool.category !== 'web' && tool.policy?.kind !== 'mcp')) return text;
	const body = text.replace(new RegExp(UNTRUSTED_TAG, 'gi'), (marker) => marker.replace('_', ' '));
	return `<${UNTRUSTED_TAG} source="${tool.id}">\n${body}\n</${UNTRUSTED_TAG}>`;
}
