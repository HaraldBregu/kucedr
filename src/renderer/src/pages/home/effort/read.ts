import type { ModelReasoningEffort } from '@shared/agent_types';

export function readEffort(providerId: string, modelId: string): ModelReasoningEffort | undefined {
	try {
		const value = localStorage.getItem(`model-effort:${JSON.stringify([providerId, modelId])}`);
		return value ? (value as ModelReasoningEffort) : undefined;
	} catch {
		return undefined;
	}
}
