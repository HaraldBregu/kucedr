import type { Tool } from '../types';
import type { ModePolicy } from './types';

const HOST_TOOLS = new Set(['tool_search', 'ask', 'update_mode_state']);
const SHELL_TOOLS = new Set(['bash', 'process']);

export function allowsTool(mode: ModePolicy, tool: Tool): boolean {
	if (HOST_TOOLS.has(tool.id)) return true;
	if (mode.shell === 'none' && SHELL_TOOLS.has(tool.id)) return false;
	if (mode.readOnly && tool.readOnly !== true) return false;
	return !mode.toolIds || mode.toolIds.includes(tool.id);
}
