import type { Tool } from '../types';
import { allowsTool } from './allows';
import { readOnlyShellError } from '../tools/core/readonly';
import type { ModePolicy } from './types';

/** Why the active modes refuse this call, or undefined when they allow it. */
export function modeGate(
	mode: ModePolicy,
	tool: Tool,
	input: Record<string, unknown>,
	workspace: string
): string | undefined {
	if (!allowsTool(mode, tool)) return `tool '${tool.id}' is unavailable in the active mode`;
	if (mode.shell === 'read-only' && tool.id === 'bash') return readOnlyShellError(input, workspace);
	return undefined;
}
