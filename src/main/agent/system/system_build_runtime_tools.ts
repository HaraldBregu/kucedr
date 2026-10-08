import type { Tool } from '../types';

export function buildRuntimeTools(tools: readonly Tool[]): string {
	const unique = [...new Map(tools.map((tool) => [tool.id, tool])).values()];
	const builtIn = unique.filter((tool) => tool.policy?.kind !== 'mcp');
	const mcp = unique.filter((tool) => tool.policy?.kind === 'mcp');
	const sections = [
		builtIn.length > 0
			? `### Built-in\n${builtIn.map((tool) => `- \`${tool.id}\``).join('\n')}`
			: '',
		mcp.length > 0 ? `### MCP\n${mcp.map((tool) => `- \`${tool.id}\``).join('\n')}` : '',
	].filter(Boolean);

	return sections.length > 0
		? `## Tools available in this runtime\n\n${sections.join('\n\n')}`
		: '## Tools available in this runtime\n\nNo tools are available for this model turn.';
}
