import type { Tool } from '../types';
import type { ModePolicy } from './types';

const HOST_TOOLS = new Set(['tool_search', 'ask']);

export function allowsTool(mode: ModePolicy, tool: Tool): boolean {
	if (mode.shell === 'none' && tool.id === 'bash') return false;
	if (mode.readOnly && tool.readOnly !== true) return false;
	return !mode.toolIds || mode.toolIds.includes(tool.id) || HOST_TOOLS.has(tool.id);
}
