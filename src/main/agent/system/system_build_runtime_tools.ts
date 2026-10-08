import type { Tool } from '../types';
import { runtimeToolCategory } from './category';
import { requiresExplicitRequest } from './explicit';

export function buildRuntimeTools(
	loadedTools: readonly Tool[],
	eligibleTools: readonly Tool[] = loadedTools
): string {
	const loaded = [...new Map(loadedTools.map((tool) => [tool.id, tool])).values()];
	const loadedIds = new Set(loaded.map((tool) => tool.id));
	const discoverable = [...new Map(eligibleTools.map((tool) => [tool.id, tool])).values()].filter(
		(tool) => !loadedIds.has(tool.id)
	);
	const sections: string[] = [];
	for (const [title, tools] of [
		['Loaded tools', loaded],
		['Available through `tool_search`', discoverable],
	] as const) {
		if (tools.length === 0) continue;
		const categories = new Map<string, Tool[]>();
		for (const tool of tools) {
			const category = runtimeToolCategory(tool);
			categories.set(category, [...(categories.get(category) ?? []), tool]);
		}
		const groups = [...categories.entries()].map(
			([category, categoryTools]) =>
				`#### ${category}\n${categoryTools
					.map((tool) => {
						const description = tool.description?.trim() || 'No description provided by this tool.';
						const restriction = requiresExplicitRequest(tool)
							? ' _(Explicit user request only.)_'
							: '';
						return `- \`${tool.id}\` — ${description}${restriction}`;
					})
					.join('\n')}`
		);
		sections.push(`### ${title}\n\n${groups.join('\n\n')}`);
	}

	return sections.length > 0
		? `## Tools available in this runtime\n\nThis inventory is generated for the current model turn and is authoritative for tool availability. Loaded tools can be called now. Tools in the discovery section must first be selected with \`tool_search\`. Use only tools relevant to the user's request. Items marked as requiring an explicit request must not be started proactively. Profile updates are also allowed during bootstrap; status and stop tools may be used to complete an already requested workflow.\n\n${sections.join('\n\n')}`
		: '## Tools available in this runtime\n\nNo tools are available for this model turn.';
}
