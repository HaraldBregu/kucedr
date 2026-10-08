import type { Tool } from '../types';

export function buildRuntimeTools(
	loadedTools: readonly Tool[],
	eligibleTools: readonly Tool[] = loadedTools
): string {
	const loaded = [...new Map(loadedTools.map((tool) => [tool.id, tool])).values()];
	const loadedIds = new Set(loaded.map((tool) => tool.id));
	const discoverable = [
		...new Map(eligibleTools.map((tool) => [tool.id, tool])).values(),
	].filter((tool) => !loadedIds.has(tool.id));
	const loadedBuiltIn = loaded.filter((tool) => tool.policy?.kind !== 'mcp');
	const loadedMcp = loaded.filter((tool) => tool.policy?.kind === 'mcp');
	const discoverableBuiltIn = discoverable.filter((tool) => tool.policy?.kind !== 'mcp');
	const discoverableMcp = discoverable.filter((tool) => tool.policy?.kind === 'mcp');
	const sections = [
		loadedBuiltIn.length > 0
			? `### Loaded built-in\n${loadedBuiltIn.map((tool) => `- \`${tool.id}\``).join('\n')}`
			: '',
		loadedMcp.length > 0
			? `### Loaded MCP\n${loadedMcp.map((tool) => `- \`${tool.id}\``).join('\n')}`
			: '',
		discoverableBuiltIn.length > 0
			? `### Available through tool_search\n${discoverableBuiltIn.map((tool) => `- \`${tool.id}\``).join('\n')}`
			: '',
		discoverableMcp.length > 0
			? `### MCP available through tool_search\n${discoverableMcp.map((tool) => `- \`${tool.id}\``).join('\n')}`
			: '',
	].filter(Boolean);

	return sections.length > 0
		? `## Tools available in this runtime\n\n${sections.join('\n\n')}`
		: '## Tools available in this runtime\n\nNo tools are available for this model turn.';
}
