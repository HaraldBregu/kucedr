import type { AgentModeInfo } from '../../../shared/agent_types';
import { BEHAVIORS } from './behaviors';
import type { ModeDefinition } from './types';

export function modeInfo(mode: ModeDefinition): AgentModeInfo {
	const tools = mode.behavior ? BEHAVIORS[mode.behavior].catalog() : [];
	return {
		id: mode.id,
		title: mode.title,
		description: mode.description,
		command: mode.command,
		persistent: mode.persistent === true,
		...(mode.output ? { output: { ...mode.output } } : {}),
		...(mode.action ? { action: { ...mode.action } } : {}),
		tools: tools.map(({ id, name, description }) => ({ id, name, description: description ?? '' })),
	};
}
