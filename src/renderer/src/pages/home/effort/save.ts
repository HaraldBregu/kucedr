import type { ModelReasoningEffort } from '@shared/agent_types';

export function saveEffort(
	providerId: string,
	modelId: string,
	effort?: ModelReasoningEffort
): void {
	const key = `model-effort:${JSON.stringify([providerId, modelId])}`;
	if (effort) localStorage.setItem(key, effort);
	else localStorage.removeItem(key);
}
