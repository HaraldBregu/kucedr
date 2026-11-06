import type { Tool } from '../types';
import { allowsTool } from './allows';
import type { ModePolicy } from './types';

export function filterModeTools(tools: Tool[], mode: ModePolicy): Tool[] {
	return tools.filter((tool) => allowsTool(mode, tool));
}
