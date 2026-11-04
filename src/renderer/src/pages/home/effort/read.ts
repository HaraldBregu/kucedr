import type { ModelReasoningEffort } from '@shared/agent_types';

export function readEffort(providerId: string, modelId: string): ModelReasoningEffort | undefined {
	try {
		const value = localStorage.getItem(`model-effort:${JSON.stringify([providerId, modelId])}`);
		return ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(value ?? '')
			? (value as ModelReasoningEffort)
			: undefined;
	} catch {
		return undefined;
	}
}
