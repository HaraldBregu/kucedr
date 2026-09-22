import { clone } from './tasks_clone';
import type { TaskRuntime } from './tasks_types';
import { getAgentProfileModel, setAgentProfileModel } from '../agent/agent_profiles';

export function setRuntime(
	providerId: string,
	modelId: string,
	options: Record<string, unknown> = {}
): TaskRuntime {
	const runtime: TaskRuntime = {
		providerId: providerId.trim(),
		modelId: modelId.trim(),
		options: { ...options },
	};
	setAgentProfileModel('tasks', 'textToText', {
		...getAgentProfileModel('tasks', 'textToText'),
		...runtime,
	});
	return clone(runtime);
}
