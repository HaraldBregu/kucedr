import type { Tool } from '../types';
import { toolCategoryRegistry, type ToolCategory } from '../tools/category';
import { requiresExplicitRequest } from './explicit';
import { toolOptions } from './system_tool_options';

export function addToolsPrompt(
	prompt: string,
	loadedTools: readonly Tool[],
	eligibleTools: readonly Tool[] = loadedTools
): string {
	const tools = [
		...new Map([...eligibleTools, ...loadedTools].map((tool) => [tool.id, tool])).values(),
	];
	if (tools.length === 0) return prompt;

	prompt += '\n\n## Tools';
	if (loadedTools.some((tool) => tool.id === 'tool_search'))
		prompt +=
			'\nOnly tools whose definitions are attached to the request can be called. To use any other tool listed here, first call `tool_search` with its id as the query; it becomes callable on the next turn. Calling a tool that is not attached fails.';
	prompt +=
		'\nWhen several tool calls do not depend on each other\'s results, request them together in one response instead of one per turn.';
	const categories = new Map<ToolCategory, Tool[]>();
	for (const tool of tools)
		categories.set(tool.category, [...(categories.get(tool.category) ?? []), tool]);
	for (const [category, metadata] of Object.entries(toolCategoryRegistry)) {
		const categoryTools = categories.get(category as ToolCategory);
		if (!categoryTools) continue;
		prompt += `\n\n### ${metadata.label}\n${metadata.description}`;
		for (const tool of categoryTools) {
			const description = (tool.description ?? '').replace(/\n/g, ' ');
			const restriction = requiresExplicitRequest(tool) ? ' _(Explicit user request only.)_' : '';
			prompt += `\n- \`${tool.id}\` (${tool.name})${description ? ` — ${description}` : ''}${toolOptions(tool.schema)}${restriction}`;
		}
	}

	return prompt;
}
