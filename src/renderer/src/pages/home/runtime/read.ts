import type { ModelReasoningEffort } from '@shared/agent_types';

export function readRuntime(
	sessionId: string
): { effort: ModelReasoningEffort; lightContext: boolean } | undefined {
	try {
		const value = localStorage.getItem(`chat-runtime:${sessionId}`);
		return value ? JSON.parse(value) : undefined;
	} catch {
		return undefined;
	}
}
