import type { ModelReasoningEffort } from '@shared/agent_types';

export function saveRuntime(
	sessionId: string,
	runtime: { effort: ModelReasoningEffort; lightContext: boolean }
): void {
	try {
		localStorage.setItem(`chat-runtime:${sessionId}`, JSON.stringify(runtime));
	} catch {
		/* empty */
	}
}
