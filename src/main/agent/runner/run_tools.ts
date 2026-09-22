import type { Tool } from '../types';
import { getToolConfiguration } from '../agent_store';
import type { AgentToolProfileId } from '../../../shared/agent_tools';

export function filterTools(
	tools: Tool[],
	allow?: readonly string[],
	deny: readonly string[] = []
): Tool[] {
	const allowed = allow ? new Set(allow) : undefined;
	const denied = new Set(deny);
	return tools.filter((tool) => (!allowed || allowed.has(tool.id)) && !denied.has(tool.id));
}

export function filterProfileTools(tools: Tool[], profileId: AgentToolProfileId): Tool[] {
	return tools.filter((tool) => {
		const settings = getToolConfiguration(
			profileId,
			tool.policy ?? { kind: 'builtin', id: tool.id }
		);
		return settings.permission !== 'deny';
	});
}
