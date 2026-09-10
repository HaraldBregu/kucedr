import { runToolCall } from '../../../../../src/main/agent/runner/run_tool_call';
import { jsonTool } from '../../../../../src/main/agent/tools/tool';
import type { ToolCall } from '../../../../../src/main/agent/types';
import { requestUserInputTool } from '../../../../../src/main/agent/tools/core/ask';
import { selectScreenSourceTool } from '../../../../../src/main/agent/tools/system/screen_source';
import { respondUserInput } from '../../../../../src/main/agent/user_input/user_input_pending';

describe('runToolCall', () => {
	it('propagates cancellation to the tool and stops waiting', async () => {
		const controller = new AbortController();
		let receivedSignal: AbortSignal | undefined;
		const tool = jsonTool({
			id: 'search_web',
			name: 'Search web',
			description: 'inspect',
			schema: { type: 'object' },
			execute: (_input, signal) => {
				receivedSignal = signal;
				return new Promise(() => undefined);
			},
		});
		const call: ToolCall = { id: 'tool-1', name: 'search_web', args: {} };
		const events = runToolCall(tool, call, controller.signal, undefined, { runId: 'run' });

		expect((await events.next()).value).toMatchObject({ type: 'tool_call_start' });
		const pending = events.next();
		controller.abort(new Error('cancelled'));

		await expect(pending).rejects.toThrow('cancelled');
		expect(receivedSignal?.aborted).toBe(true);
		expect(call.result).toBeUndefined();
	});

	it('runs an allowed tool and records its result', async () => {
		const run = jest.fn().mockResolvedValue('done');
		const tool = jsonTool({
			id: 'inspect',
			name: 'Inspect',
			description: 'run',
			schema: { type: 'object' },
			execute: run,
		});
		const call: ToolCall = { id: 'tool-2', name: 'inspect', args: { value: 'one' } };
		const events = [];

		for await (const event of runToolCall(
			tool,
			call,
			new AbortController().signal,
			undefined,
			{ runId: 'run' }
		)) {
			events.push(event);
		}

		expect(run).toHaveBeenCalledWith({ value: 'one' }, expect.any(AbortSignal));
		expect(events).not.toContainEqual(expect.objectContaining({ type: 'tool_permission_request' }));
		expect(call.result).toMatchObject({ content: 'done', isError: undefined });
	});

	it('denies a destructive tool without interactive one-time approval', async () => {
		const run = jest.fn();
		const tool = jsonTool({
			id: 'destructive_tool',
			name: 'Destructive',
			description: 'delete',
			hardApproval: true,
			schema: { type: 'object' },
			execute: run,
		});
		const call: ToolCall = { id: 'destructive', name: tool.id, args: {} };

		for await (const _event of runToolCall(
			tool,
			call,
			new AbortController().signal,
			undefined,
			{ runId: 'run' }
		))
			void _event;

		expect(run).not.toHaveBeenCalled();
		expect(call.result).toMatchObject({ isError: true });
		expect(call.result?.content).toContain('permission denied');
	});

	it('returns a tool error without leaking it as an operational failure', async () => {
		const tool = jsonTool({
			id: 'inspect',
			name: 'Inspect',
			description: 'run',
			schema: { type: 'object' },
			execute: () => {
				throw new Error('tool failed');
			},
		});
		const call: ToolCall = { id: 'tool-3', name: 'inspect', args: {} };

		for await (const _event of runToolCall(
			tool,
			call,
			new AbortController().signal,
			undefined,
			{ runId: 'run' }
		))
			void _event;

		expect(call.result).toMatchObject({ isError: true });
		expect(call.result?.content).toContain('tool failed');
	});

	it('rejects an unclassified tool before execution in Plan mode', async () => {
		const run = jest.fn();
		const tool = jsonTool({
			id: 'write_like_tool',
			name: 'Unsafe',
			description: 'unsafe',
			schema: { type: 'object' },
			execute: run,
		});
		const call: ToolCall = { id: 'plan-guard', name: tool.id, args: {} };

		for await (const _event of runToolCall(
			tool,
			call,
			new AbortController().signal,
			undefined,
			{ runId: 'run', interactionMode: 'plan' }
		))
			void _event;

		expect(run).not.toHaveBeenCalled();
		expect(call.result).toMatchObject({ isError: true });
		expect(call.result?.content).toContain('unavailable in Plan mode');
	});

	it('resumes the same Plan tool call after structured answers', async () => {
		const call: ToolCall = {
			id: 'question-call',
			name: 'ask',
			args: {
				questions: [
					{
						id: 'scope',
						header: 'Scope',
						question: 'Which scope?',
						options: [
							{ label: 'Small', description: 'One part.' },
							{ label: 'Large', description: 'All parts.' },
						],
					},
				],
			},
		};
		const events = runToolCall(
			requestUserInputTool,
			call,
			new AbortController().signal,
			undefined,
			{ runId: 'run', windowId: 7, interactionMode: 'plan' }
		);

		expect((await events.next()).value).toMatchObject({ type: 'tool_call_start' });
		const request = (await events.next()).value;
		expect(request).toMatchObject({ type: 'user_input_request', toolCallId: call.id });
		if (!request || request.type !== 'user_input_request') throw new Error('Expected request');
		const resultEvent = events.next();
		await Promise.resolve();
		expect(
			respondUserInput(
				{
					requestId: request.requestId,
					runId: 'run',
					toolCallId: call.id,
					inputFingerprint: request.inputFingerprint,
				},
				[{ questionId: 'scope', answer: 'Small' }],
				7
			)
		).toBe(true);
		expect((await resultEvent).value).toMatchObject({
			type: 'user_input_result',
			status: 'resolved',
		});
		expect((await events.next()).value).toMatchObject({ type: 'tool_call_end', isError: false });
		await events.next();
		expect(call.result).toMatchObject({ isError: false });
	});

	it('waits for a screen source selection in an interactive chat run', async () => {
		const call: ToolCall = {
			id: 'screen-source-call',
			name: 'select_screen_source',
			args: {
				sources: [
					{ id: 'screen:1', name: 'Display 1', type: 'screen' },
					{ id: 'window:2', name: 'Kucedr', type: 'window' },
				],
			},
		};
		const events = runToolCall(
			selectScreenSourceTool,
			call,
			new AbortController().signal,
			undefined,
			{ runId: 'run', windowId: 7, interactionMode: 'default' }
		);

		expect((await events.next()).value).toMatchObject({ type: 'tool_call_start' });
		const request = await events.next();
		expect(request.value).toMatchObject({ type: 'user_input_request', toolCallId: call.id });
		if (!request.value || request.value.type !== 'user_input_request') {
			throw new Error('Expected screen source request');
		}
		const resultEvent = events.next();
		await Promise.resolve();
		expect(
			respondUserInput(
				{
					requestId: request.value.requestId,
					runId: 'run',
					toolCallId: call.id,
					inputFingerprint: request.value.inputFingerprint,
				},
				[{ questionId: 'screen-source', answer: 'window:2' }],
				7
			)
		).toBe(true);
		expect((await resultEvent).value).toMatchObject({ type: 'user_input_result', status: 'resolved' });
		await events.next();
		expect(call.result).toMatchObject({ content: { status: 'resolved', sourceId: 'window:2' } });
	});
});
