import {
 	agentProfileStorePath,
	getAgentProfileDocument,
	setAgentProfileDocument,
} from '../agent/agent_profiles';
import { DEFAULT_TASK_STATE, type PersistedTaskState } from './tasks_types';

export const taskStorePath = agentProfileStorePath('tasks');

export function getTaskState(): PersistedTaskState {
	const stored = getAgentProfileDocument('tasks') as Partial<PersistedTaskState>;
	return {
		...DEFAULT_TASK_STATE,
		...stored,
		schedules: [...(stored.schedules ?? [])],
	};
}

export function setTaskState(value: PersistedTaskState): void {
	setAgentProfileDocument('tasks', { ...getAgentProfileDocument('tasks'), ...value });
}
