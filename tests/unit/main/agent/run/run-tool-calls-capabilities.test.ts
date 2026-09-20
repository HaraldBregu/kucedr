import { runToolCalls } from '../../../../../src/main/agent/runner/run_tool_calls';
import type { Tool, ToolCall } from '../../../../../src/main/agent/types';
import { requestUserInputTool } from '../../../../../src/main/agent/tools/core/ask';

function fakeTool(name: string, output: string): Tool {
	return {
		id: name,
		name,
		description: name,
		schema: { type: 'object' },
		timeoutMs: 1_000,
		maxOutputBytes: 1_000,
		parseInput: () => ({}),
		run: () => output,
	};
}

describe('runToolCalls capability changes', () => {
	it('uses the current tool set for every call in a model batch', async () => {
		const load = fakeTool('activate', 'loaded');
		const write = fakeTool('write', 'wrote');
		const tools = [load, write];
		const calls: ToolCall[] = [
			{ id: '1', name: 'activate', args: {} },
			{ id: '2', name: 'write', args: {} },
		];
		const outputs: unknown[] = [];

		for await (const event of runToolCalls(
			tools,
			calls,
			new AbortController().signal,
			undefined,
			{ runId: 'run' }
		)) {
			if (event.type !== 'tool_call_end') continue;
			outputs.push(event.output);
			if (event.toolName === 'activate') tools.splice(0, tools.length, load);
		}

		expect(outputs).toEqual(['loaded', "Error: unknown tool 'write'"]);
	});

	it('stops an aborted batch after persisting an interrupted input result', async () => {
		const controller = new AbortController();
		const read = fakeTool('read', 'read');
		const calls: ToolCall[] = [
			{
				id: 'question',
				name: 'ask',
				args: {
					questions: [
						{
							id: 'scope',
							header: 'Scope',
							question: 'Which scope?',
							options: [
								{ label: 'One', description: 'One area.' },
								{ label: 'All', description: 'All areas.' },
							],
						},
					],
				},
			},
			{ id: 'read', name: 'read', args: {} },
		];
		const events = runToolCalls(
			[requestUserInputTool, read],
			calls,
			controller.signal,
			undefined,
			{ runId: 'run', windowId: 1, interactionMode: 'plan' }
		);
		expect((await events.next()).value).toMatchObject({ type: 'tool_call_start' });
		expect((await events.next()).value).toMatchObject({ type: 'user_input_request' });
		const result = events.next();
		controller.abort(new Error('stopped'));
		expect((await result).value).toMatchObject({
			type: 'user_input_result',
			status: 'interrupted',
		});
		for await (const _event of events) void _event;
		expect(calls[0].result?.content).toContain('interrupted');
		expect(calls[1].result).toBeUndefined();
	});
});
