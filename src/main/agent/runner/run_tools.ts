import type { Tool } from '../types';

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
