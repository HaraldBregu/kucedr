import type { Tool } from '../types';

export function selectSkillTools(tools: Tool[], allowedTools: string[] | undefined): Tool[] {
	if (!allowedTools) return tools;
	const allowed = new Set(allowedTools);
	return tools.filter(
		(tool) =>
			tool.id === 'load_skill' ||
			tool.id === 'tool_search' ||
			(tool.id !== 'subagent' && allowed.has(tool.id))
	);
}
