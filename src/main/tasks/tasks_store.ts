import {
	agentProfileStorePath,
	getAgentProfileDocument,
	setAgentProfileDocument,
} from '../agent/agent_profiles';
import { DEFAULT_TASK_STATE, type PersistedTaskState } from './tasks_types';

export const taskStorePath = agentProfileStorePath('tasks');

export function getTaskState(): PersistedTaskState {
	const {
		textToText: _textToText,
		textToSpeech: _textToSpeech,
		speechToText: _speechToText,
		realtimeVoice: _realtimeVoice,
		image: _image,
		audio: _audio,
		video: _video,
		tools: _tools,
		mcpTools: _mcpTools,
		...stored
	} = getAgentProfileDocument('tasks') as Partial<PersistedTaskState> & Record<string, unknown>;
	return {
		...DEFAULT_TASK_STATE,
		...stored,
		schedules: [...(stored.schedules ?? [])],
	};
}

export function setTaskState(value: PersistedTaskState): void {
	setAgentProfileDocument('tasks', { ...getAgentProfileDocument('tasks'), ...value });
}
