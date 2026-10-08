import type { Tool } from '../types';
import { toolCategoryRegistry, type ToolCategory } from '../tools/category';
import { requiresExplicitRequest } from './explicit';

export function addToolsPrompt(
	prompt: string,
	loadedTools: readonly Tool[],
	eligibleTools: readonly Tool[] = loadedTools
): string {
	const loaded = [...new Map(loadedTools.map((tool) => [tool.id, tool])).values()];
	const loadedIds = new Set(loaded.map((tool) => tool.id));
	const discoverable = [
		...new Map(eligibleTools.map((tool) => [tool.id, tool])).values(),
	].filter((tool) => !loadedIds.has(tool.id));
	if (loaded.length === 0 && discoverable.length === 0) return prompt;

	const sections = [
		['Loaded tools', loaded],
		['Available through `tool_search`', discoverable],
	] as const;
	prompt += '\n\n## Tools';
	prompt +=
		'\nLoaded tools can be called now. Tools available through `tool_search` must be selected before use.';
	for (const [title, tools] of sections) {
		if (tools.length === 0) continue;
		prompt += `\n\n### ${title}`;
		const categories = new Map<ToolCategory, Tool[]>();
		for (const tool of tools)
			categories.set(tool.category, [...(categories.get(tool.category) ?? []), tool]);
		for (const [category, metadata] of Object.entries(toolCategoryRegistry)) {
			const categoryTools = categories.get(category as ToolCategory);
			if (!categoryTools) continue;
			prompt += `\n\n#### ${metadata.label}\n${metadata.description}`;
			for (const tool of categoryTools) {
				const description = (tool.description ?? '').replace(/\n/g, ' ');
				const restriction = requiresExplicitRequest(tool)
					? ' _(Explicit user request only.)_'
					: '';
				prompt += `\n- \`${tool.id}\` (${tool.name})${description ? ` — ${description}` : ''}${restriction}`;
			}
		}
	}

	return prompt;
}
