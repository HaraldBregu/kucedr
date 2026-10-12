import { runToolCall } from '../../../../../src/main/agent/runner/run_tool_call';
import { jsonTool } from '../../../../../src/main/agent/tools/tool';

it('clears the tool timeout while retaining parent-run cancellation after return', async () => {
	jest.useFakeTimers();
	try {
		let receivedSignal: AbortSignal | undefined;
		const tool = jsonTool({
			id: 'background_test',
			name: 'Background test',
			description: 'test',
			timeoutMs: 20,
			capability: { effects: ['read'] },
			schema: { type: 'object' },
			execute: async (_input, signal) => {
				receivedSignal = signal;
				return 'started';
			},
		});
		const controller = new AbortController();
		for await (const _event of runToolCall(
			tool,
			{ id: 'call', name: tool.id, args: {} },
			controller.signal,
			undefined,
			{ runId: 'run' }
		)) {
			void _event;
		}
		jest.advanceTimersByTime(100);
		expect(receivedSignal?.aborted).toBe(false);

		controller.abort(new Error('cancel parent run'));
		expect(receivedSignal?.aborted).toBe(true);
	} finally {
		jest.useRealTimers();
	}
});
