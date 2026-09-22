import { TaskState, taskStateToJSON } from '@a2a-js/sdk';

export function formatA2aTaskOutcome(
	taskId: string,
	contextId: string,
	state: TaskState | undefined,
	text: string
): string {
	const reference = `${taskId || 'unknown'}${contextId ? ` (context ${contextId})` : ''}`;
	const label =
		state === undefined
			? 'unknown'
			: taskStateToJSON(state)
					.replace(/^TASK_STATE_/, '')
					.toLowerCase()
					.replaceAll('_', ' ');
	const content = text.trim();
	if (state === TaskState.TASK_STATE_INPUT_REQUIRED) {
		return `Remote task ${reference} requires input${content ? `: ${content}` : '.'}`;
	}
	if (state === TaskState.TASK_STATE_AUTH_REQUIRED) {
		return `Remote task ${reference} requires authentication${content ? `: ${content}` : '.'}`;
	}
	if (state === TaskState.TASK_STATE_COMPLETED) return content || `Remote task ${reference} is completed.`;
	return `Remote task ${reference} is ${label}${content ? `: ${content}` : '.'}`;
}
