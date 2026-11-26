import type { ModelReasoningEffort } from '@shared/agent_types';
import { scoped } from '@/spaces/scoped';

export function saveRuntime(
	sessionId: string,
	runtime: { effort: ModelReasoningEffort; lightContext: boolean }
): void {
	try {
		localStorage.setItem(scoped(`chat-runtime:${sessionId}`), JSON.stringify(runtime));
	} catch {
		/* empty */
	}
}
