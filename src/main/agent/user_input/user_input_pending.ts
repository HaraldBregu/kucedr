import type {
	AgentUserInputAnswer,
	AgentUserInputScope,
} from '../../../shared/agent_types';

export interface PendingUserInput extends AgentUserInputScope {
	questionIds: string[];
	expiresAtMs: number;
	windowId: number;
}

const pending = new Map<
	string,
	{
		request: PendingUserInput;
		settle: (answers: AgentUserInputAnswer[] | undefined) => void;
		timer: NodeJS.Timeout;
	}
>();

export function waitForUserInput(
	request: PendingUserInput,
	signal?: AbortSignal
): Promise<AgentUserInputAnswer[] | undefined> {
	if (signal?.aborted) return Promise.resolve(undefined);
	return new Promise((resolve) => {
		let settled = false;
		const abort = (): void => settle(undefined);
		const settle = (answers: AgentUserInputAnswer[] | undefined): void => {
			if (settled) return;
			settled = true;
			pending.delete(request.requestId);
			clearTimeout(timer);
			signal?.removeEventListener('abort', abort);
			resolve(answers);
		};
		const timer = setTimeout(() => settle(undefined), Math.max(0, request.expiresAtMs - Date.now()));
		timer.unref?.();
		pending.get(request.requestId)?.settle(undefined);
		pending.set(request.requestId, { request, settle, timer });
		signal?.addEventListener('abort', abort, { once: true });
		if (signal?.aborted) abort();
	});
}

export function respondUserInput(
	scope: AgentUserInputScope,
	answers: AgentUserInputAnswer[],
	windowId: number
): boolean {
	const entry = pending.get(scope.requestId);
	if (!entry || entry.request.expiresAtMs <= Date.now()) return false;
	const expected = entry.request;
	if (
		expected.windowId !== windowId ||
		expected.runId !== scope.runId ||
		expected.toolCallId !== scope.toolCallId ||
		expected.inputFingerprint !== scope.inputFingerprint ||
		answers.length !== expected.questionIds.length ||
		answers.some((answer) => !expected.questionIds.includes(answer.questionId))
	)
		return false;
	entry.settle(answers);
	return true;
}

export function interruptPendingUserInput(runId?: string): void {
	for (const entry of pending.values()) {
		if (runId && entry.request.runId !== runId) continue;
		entry.settle(undefined);
	}
}
