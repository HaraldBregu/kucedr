import { clone } from './tasks_clone';
import type { TaskRuntime } from './tasks_types';
import { getAgentProfileModel } from '../agent/agent_profiles';

export function getRuntime(): TaskRuntime | undefined {
	const runtime = getAgentProfileModel('tasks', 'textToText');
	return runtime.providerId && runtime.modelId
		? clone({ providerId: runtime.providerId, modelId: runtime.modelId, options: runtime.options })
		: undefined;
}
