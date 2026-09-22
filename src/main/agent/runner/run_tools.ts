import type { Tool } from '../types';
import { getToolConfiguration } from '../agent_store';
import type { AgentToolProfileId } from '../../../shared/agent_tools';
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

export function filterDisabledTools(
	tools: Tool[],
	settings: Readonly<Record<string, { enabled: boolean }>> | undefined
): Tool[] {
	return tools.filter((tool) => settings?.[tool.id]?.enabled !== false);
}

export function filterProfileTools(tools: Tool[], profileId: AgentToolProfileId): Tool[] {
	return tools.filter((tool) => {
		const settings = getToolConfiguration(
			profileId,
			tool.policy ?? { kind: 'builtin', id: tool.id }
		);
		return settings.enabled && settings.permission !== 'deny';
	});
}

export function filterProfileTools(tools: Tool[], profileId: AgentToolProfileId): Tool[] {
	return tools.filter((tool) => {
		const settings = getToolConfiguration(
			profileId,
			tool.policy ?? { kind: 'builtin', id: tool.id }
		);
		return settings.enabled && settings.permission !== 'deny';
	});
}
