import type { Tool } from '../types';

export function mcpAuthorizationRequired(
	tool: Tool | undefined,
	output: unknown
): { status: 'authorization_required'; serverId: string; serverName: string } | undefined {
	if (tool?.policy?.kind !== 'mcp') return undefined;
	if (!output || typeof output !== 'object' || Array.isArray(output)) return undefined;
	const result = output as { status?: unknown; serverId?: unknown; serverName?: unknown };
	if (result.status !== 'authorization_required' || result.serverId !== tool.policy.serverId)
		return undefined;
	return {
		status: 'authorization_required',
		serverId: result.serverId,
		serverName: typeof result.serverName === 'string' ? result.serverName : result.serverId,
	};
}
