import type { Tool } from '../types';
import { toolCategoryRegistry, type ToolCategory } from '../tools/category';
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
		const categories = new Map<ToolCategory, Tool[]>();
		for (const tool of tools) {
			categories.set(tool.category, [...(categories.get(tool.category) ?? []), tool]);
		}
		const groups = Object.entries(toolCategoryRegistry).flatMap(([category, metadata]) => {
			const categoryTools = categories.get(category as ToolCategory);
			return categoryTools
				? [`#### ${metadata.label}\n${categoryTools
					.map((tool) => {
						const description = tool.description?.trim() || 'No description provided by this tool.';
						const restriction = requiresExplicitRequest(tool)
							? ' _(Explicit user request only.)_'
							: '';
						return `- \`${tool.id}\` — ${description}${restriction}`;
					})
					.join('\n')}`]
				: [];
		});
		sections.push(`### ${title}\n\n${groups.join('\n\n')}`);
	}

	return sections.length > 0
		? `## Tools available in this runtime\n\nThis inventory is generated for the current model turn and is authoritative for tool availability. Loaded tools can be called now. Tools in the discovery section must first be selected with \`tool_search\`. Use only tools relevant to the user's request. Items marked as requiring an explicit request must not be started proactively. Profile updates are also allowed during bootstrap; status and stop tools may be used to complete an already requested workflow.\n\nWeb access rule: Do not call \`search_web\`, \`fetch_web_page\`, or \`use_web_browser\` merely because the user asks about a person, organization, place, or topic. Answer from the available conversation, memory, and reliable existing knowledge when sufficient. When the user explicitly asks to search, browse, look up, or verify something online, asks to use a browser or web tool, provides a URL and asks you to use it, or approves previously proposed web access, authorization is already granted. Immediately call the requested or most relevant web tool, using \`tool_search\` first only if needed. Do not ask for web permission again, offer a menu of possible searches instead of acting, or require another confirmation. Let the application permission layer surface any configured approval. If accurate current or external information is needed but the user has not authorized web access, explain why a web search is needed, ask whether they want you to perform it, and wait for their response.\n\n${sections.join('\n\n')}`
		: '## Tools available in this runtime\n\nNo tools are available for this model turn.';
}
