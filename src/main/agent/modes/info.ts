import type { AgentModeInfo } from '../../../shared/agent_types';
import type { ModeDefinition } from './types';

export function modeInfo(mode: ModeDefinition): AgentModeInfo {
	return {
		id: mode.id,
		title: mode.title,
		description: mode.description,
		command: mode.command,
		persistent: mode.persistent === true,
		plugin: mode.plugin.name,
		...(mode.output ? { output: { ...mode.output } } : {}),
		...(mode.action ? { action: { ...mode.action } } : {}),
	};
}
