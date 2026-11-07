import type { AgentModeInfo } from '../../../shared/agent_types';
import type { ModeDefinition } from './types';

export function modeInfo(mode: ModeDefinition): AgentModeInfo {
	return {
		id: mode.id,
		title: mode.title,
		description: mode.description,
		command: mode.command,
		persistent: mode.persistent === true,
		...(mode.output ? { output: { ...mode.output } } : {}),
		...(mode.action ? { action: { ...mode.action } } : {}),
	};
}
