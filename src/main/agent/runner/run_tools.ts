import type { Tool } from '../types';
import { getToolConfiguration } from '../agent_store';
import { resolvePermission } from '../permissions';
import { EMPTY_PERMISSIONS } from '../permissions/permissions_types';
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
		const capability =
			typeof tool.capability === 'function' ? tool.capability({}) : tool.capability;
		return (
			resolvePermission({
				permissions: EMPTY_PERMISSIONS,
				setting: getToolConfiguration(profileId, tool.policy ?? { kind: 'builtin', id: tool.id })
					.permission,
				approval: capability?.approval === true,
				interactive: profileId !== 'tasks',
			}).mode !== 'deny'
		);
	});
}
