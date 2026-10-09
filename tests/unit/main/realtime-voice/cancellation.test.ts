import { RealtimeVoiceToolRuntime } from '../../../../src/main/agent/realtime_voice/tool_runtime';
import { KeyedMutex } from '../../../../src/main/agent/mutex';
import type { Tool } from '../../../../src/main/agent/types';

it('aborts a cancelled call without aborting the next call in the same response', async () => {
	let started = (): void => undefined;
	const running = new Promise<void>((resolve) => { started = resolve; });
	let finished = (): void => undefined;
	const done = new Promise<void>((resolve) => { finished = resolve; });
	let receivedSignal: AbortSignal | undefined;
	const tools: Tool[] = ['first', 'second'].map((id) => ({
		id, name: id, description: id, schema: { type: 'object' }, capability: { effects: ['read'] },
		timeoutMs: 1000, maxOutputBytes: 1000, parseInput: (input) => input,
		run: async (_input, signal) => {
			if (id === 'second') return 'second result';
			receivedSignal = signal;
			started();
			return new Promise<string>((resolve) => signal?.addEventListener('abort', () => resolve('cancelled'), { once: true }));
		},
	}));
	const addToolResult = jest.fn();
	const returned = jest.fn(async (callId: string) => { if (callId === 'second') finished(); });
	const runtime = new RealtimeVoiceToolRuntime({
		sessionId: 'voice', windowId: 1, tools, signal: new AbortController().signal,
		resources: new KeyedMutex(), conversation: { addToolCall: jest.fn(), addToolResult },
		connection: () => ({ appendAudio: async () => undefined, interrupt: async () => undefined, stop: async () => undefined, addToolResult: returned }),
		emit: jest.fn(), onThinking: jest.fn(), onError: (error) => { throw error; },
	});
	for (const callId of ['first', 'second']) runtime.handle({ type: 'tool_call', callId, itemId: callId, responseId: 'response', name: callId, arguments: '{}' });
	await running;
	runtime.cancel('first');
	await done;
	expect(receivedSignal?.aborted).toBe(true);
	expect(runtime.observe('response')).toBe(true);
	expect(returned.mock.calls.map(([id]) => id)).toEqual(['second']);
	expect(addToolResult).toHaveBeenCalledWith(expect.objectContaining({ id: 'first', result: expect.objectContaining({ isError: true }) }));
});
