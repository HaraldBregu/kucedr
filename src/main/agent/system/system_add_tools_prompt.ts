import type { Tool } from '../types';
import { toolCategoryRegistry, type ToolCategory } from '../tools/category';

export function addToolsPrompt(prompt: string, tools: Tool[]): string {
	const nativeTools = tools.filter((tool) => !tool.id.startsWith('mcp__'));
	if (nativeTools.length === 0) return prompt;

	prompt += '\n\n## Tools';
	prompt += '\nThe following built-in tools are available to you:';
	const categories = new Map<ToolCategory, Tool[]>();
	for (const tool of nativeTools)
		categories.set(tool.category, [...(categories.get(tool.category) ?? []), tool]);
	for (const [category, metadata] of Object.entries(toolCategoryRegistry)) {
		const categoryTools = categories.get(category as ToolCategory);
		if (!categoryTools) continue;
		prompt += `\n\n### ${metadata.label}\n${metadata.description}`;
		for (const tool of categoryTools) {
			const description = (tool.description ?? '').replace(/\n/g, ' ');
			prompt += `\n- \`${tool.id}\` (${tool.name})${description ? ` — ${description}` : ''}`;
		}
	}

	return prompt;
}
