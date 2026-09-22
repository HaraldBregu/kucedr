import { clone } from './tasks_clone';
import type { TaskRuntime } from './tasks_types';
import { getAgentProfileModel, setAgentProfileModel } from '../agent/agent_profiles';

export function setRuntime(providerId: string, modelId: string): TaskRuntime {
	const runtime: TaskRuntime = { providerId: providerId.trim(), modelId: modelId.trim() };
	setAgentProfileModel('tasks', 'textToText', {
		...getAgentProfileModel('tasks', 'textToText'),
		...runtime,
	});
	return clone(runtime);
}
