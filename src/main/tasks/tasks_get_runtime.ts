import { clone } from './tasks_clone';
import { readState } from './tasks_read_state';
import type { TaskRuntime } from './tasks_types';
import { getAgentProfileModel, initializeAgentProfile } from '../agent/agent_profiles';

export function getRuntime(): TaskRuntime | undefined {
	const { providerId, modelId } = readState();
	initializeAgentProfile(
		'tasks',
		{
			textToText: { providerId: providerId ?? '', modelId: modelId ?? '', options: {} },
		},
		'tasks-runtime'
	);
	const runtime = getAgentProfileModel('tasks', 'textToText');
	return runtime.providerId && runtime.modelId
		? clone({ providerId: runtime.providerId, modelId: runtime.modelId, options: runtime.options })
		: undefined;
}
