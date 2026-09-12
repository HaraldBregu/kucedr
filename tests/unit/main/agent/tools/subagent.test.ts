const mockStream = jest.fn();

jest.mock('../../../../../src/main/agent/runner/run_stream', () => ({
	stream: (...args: unknown[]) => mockStream(...args),
}));

import type { SessionState } from '../../../../../src/main/agent/session';
import type { RunContext } from '../../../../../src/main/agent/context';
import { subagentTool, subagentsTool } from '../../../../../src/main/agent/tools/core/subagents';
import { jsonTool } from '../../../../../src/main/agent/tools/tool';
import { KeyedLimiter } from '../../../../../src/main/agent/limiter';

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('subagentTool', () => {
	beforeEach(() => {
		mockStream.mockReset();
	});

	it('ignores model-supplied system instructions', async () => {
		mockStream.mockReturnValue(
			(async function* () {
				yield { type: 'assistant_message', content: 'done', toolCalls: [] };
			})()
		);
		const tool = subagentTool({ location: '/agent' }, [], { type: 'default' });

		await tool.run({ task: 'inspect context', systemPrompt: 'Act as a test reviewer.' });

		const session = mockStream.mock.calls[0][1] as SessionState;
		expect(session.messages).toEqual([{ role: 'user', content: 'inspect context' }]);
		expect(mockStream.mock.calls[0][4].instructions).not.toContain('Act as a test reviewer.');
		expect(mockStream.mock.calls[0][4].instructions).toContain('- Stay focused:');
		expect(mockStream.mock.calls[0][4].tools).toEqual([]);
		expect(mockStream.mock.calls[0][2]).toMatchObject({
			type: 'default',
			agentId: 'subagent',
			contextMode: 'minimal',
			toolsAllow: [],
		});
	});

	it('creates fresh isolated context for every child execution', async () => {
		mockStream.mockReturnValue(
			(async function* () {
				yield { type: 'assistant_message', content: 'done', toolCalls: [] };
			})()
		);
		const tool = subagentTool({ location: '/agent' }, [], { type: 'default' });

		await tool.run({ task: 'first' });
		await tool.run({ task: 'second' });

		const first = mockStream.mock.calls[0][1] as SessionState;
		const second = mockStream.mock.calls[1][1] as SessionState;
		first.runContext.fileAccess.readDirectories.add('/first');
		first.runContext.loadedSkills.push({
			id: 'one',
			name: 'One',
			canonicalRoot: '/skills/one',
			instructions: 'one',
			trust: 'user-controlled',
			hash: 'one',
			resources: [],
		});
		expect(second.runContext.fileAccess.readDirectories).toEqual(new Set());
		expect(second.runContext.loadedSkills).toEqual([]);
	});

	it('runs three batch children concurrently, preserves order, and isolates failure', async () => {
		const releases = new Map<string, () => void>();
		const contexts: RunContext[] = [];
		let active = 0;
		let peak = 0;
		mockStream.mockImplementation(
			(_config: unknown, session: SessionState, input: { message: string }) =>
				(async function* () {
					contexts.push(session.runContext);
					active += 1;
					peak = Math.max(peak, active);
					await new Promise<void>((resolve) => releases.set(input.message, resolve));
					active -= 1;
					if (input.message === 'fail') throw new Error('child failed');
					yield { type: 'assistant_message', content: `${input.message}:done`, toolCalls: [] };
				})()
		);
		const tool = subagentsTool({ location: '/agent' }, [], { type: 'default' });
		const pending = tool.run({
			tasks: [
				{ id: 'first', task: 'slow' },
				{ id: 'second', task: 'fail' },
				{ id: 'third', task: 'fast' },
			],
		}) as Promise<unknown>;

		await flush();
		expect(peak).toBe(3);
		expect(new Set(contexts).size).toBe(3);
		contexts[0].fileAccess.readDirectories.add('/first');
		expect(
			contexts.slice(1).every((context) => context.fileAccess.readDirectories.size === 0)
		).toBe(true);
		releases.get('fast')?.();
		releases.get('fail')?.();
		releases.get('slow')?.();
		await expect(pending).resolves.toEqual([
			{ id: 'first', status: 'completed', text: 'slow:done' },
			{ id: 'second', status: 'failed', text: '', error: 'child failed' },
			{ id: 'third', status: 'completed', text: 'fast:done' },
		]);
	});

	it('gives batch children only explicitly parallel-safe tools', async () => {
		mockStream.mockImplementation(
			(_config: unknown, _session: unknown, input: { message: string }) =>
				(async function* () {
					yield { type: 'assistant_message', content: input.message, toolCalls: [] };
				})()
		);
		const safe = jsonTool({
			id: 'read',
			name: 'Read file',
			description: 'read',
			schema: { type: 'object' },
			execute: () => undefined,
		});
		const unsafe = jsonTool({
			id: 'bash',
			name: 'Exec command',
			description: 'execute',
			schema: { type: 'object' },
			execute: () => undefined,
		});
		const tool = subagentsTool({ location: '/agent' }, [safe, unsafe], { type: 'default' });

		await tool.run({
			tasks: [
				{ id: 'a', task: 'a' },
				{ id: 'b', task: 'b' },
			],
		});

		for (const call of mockStream.mock.calls) {
			expect(call[4].tools.map((candidate: { id: string }) => candidate.id)).toEqual(['read']);
		}
	});

	it('shares a process pool and propagates parent cancellation to every active child', async () => {
		const signals: AbortSignal[] = [];
		mockStream.mockImplementation(
			(_config: unknown, _session: unknown, _input: unknown, signal: AbortSignal) =>
				(async function* () {
					signals.push(signal);
					await new Promise<void>((_resolve, reject) => {
						signal.addEventListener('abort', () => reject(signal.reason), { once: true });
					});
					yield* [];
				})()
		);
		const controller = new AbortController();
		const pool = new KeyedLimiter(3);
		const tool = subagentsTool({ location: '/agent' }, [], { type: 'default' }, pool);
		const pending = tool.run(
			{
				tasks: [
					{ id: 'a', task: 'a' },
					{ id: 'b', task: 'b' },
					{ id: 'c', task: 'c' },
				],
			},
			controller.signal
		) as Promise<Array<{ status: string }>>;

		await flush();
		expect(signals).toHaveLength(3);
		controller.abort(new Error('cancel parent'));
		await expect(pending).resolves.toEqual(
			expect.arrayContaining([expect.objectContaining({ status: 'cancelled' })])
		);
		expect(signals.every((signal) => signal.aborted)).toBe(true);
	});

	it('caps child concurrency across simultaneous batches with the shared pool', async () => {
		const releases: Array<() => void> = [];
		let active = 0;
		let peak = 0;
		mockStream.mockImplementation(
			(_config: unknown, _session: unknown, input: { message: string }) =>
				(async function* () {
					active += 1;
					peak = Math.max(peak, active);
					await new Promise<void>((resolve) => releases.push(resolve));
					active -= 1;
					yield { type: 'assistant_message', content: input.message, toolCalls: [] };
				})()
		);
		const pool = new KeyedLimiter(3);
		const tool = subagentsTool({ location: '/agent' }, [], { type: 'default' }, pool);
		const first = tool.run({
			tasks: [
				{ id: 'a', task: 'a' },
				{ id: 'b', task: 'b' },
			],
		}) as Promise<unknown>;
		const second = tool.run({
			tasks: [
				{ id: 'c', task: 'c' },
				{ id: 'd', task: 'd' },
			],
		}) as Promise<unknown>;

		await flush();
		expect(releases).toHaveLength(3);
		expect(peak).toBe(3);
		releases[0]();
		await flush();
		expect(releases).toHaveLength(4);
		for (const release of releases.slice(1)) release();
		await Promise.all([first, second]);
		expect(peak).toBe(3);
	});

	it('requires two or three independent tasks', async () => {
		const tool = subagentsTool({ location: '/agent' }, [], { type: 'default' });
		await expect(tool.run({ tasks: [{ id: 'one', task: 'one' }] })).rejects.toThrow();
		await expect(
			tool.run({
				tasks: [
					{ id: '1', task: '1' },
					{ id: '2', task: '2' },
					{ id: '3', task: '3' },
					{ id: '4', task: '4' },
				],
			})
		).rejects.toThrow();
		await expect(
			tool.run({
				tasks: [
					{ id: 'duplicate', task: 'one' },
					{ id: 'duplicate', task: 'two' },
				],
			})
		).rejects.toThrow('Subagent task ids must be unique.');
	});

	it('inherits the pinned execution contract and reports structured results', async () => {
		mockStream.mockReturnValue(
			(async function* () {
				yield { type: 'assistant_message', content: 'done', toolCalls: [] };
				yield {
					type: 'run_finished',
					result: {
						text: 'done',
						model: 'pinned-model',
						toolCalls: [],
						numTurns: 1,
						subtype: 'success',
						sessionId: 'child',
						stopReason: 'end_turn',
						usage: { inputTokens: 2, outputTokens: 3 },
					},
				};
			})()
		);
		const scope = {
			ownerId: 'channel',
			source: 'channel' as const,
			sessionId: 'parent',
			runId: 'parent',
		};
		const tool = subagentTool({ location: '/agent' }, [], {
			type: 'background',
			interactionMode: 'default',
			providerId: 'pinned-provider',
			model: 'pinned-model',
			effort: 'high',
			scope,
		});

		await expect(tool.run({ task: 'inspect' })).resolves.toEqual({
			status: 'completed',
			text: 'done',
			stopReason: 'end_turn',
			usage: { inputTokens: 2, outputTokens: 3 },
			result: {
				sessionId: 'child',
				model: 'pinned-model',
				subtype: 'success',
				toolCalls: [],
			},
		});
		expect(mockStream.mock.calls[0][2]).toMatchObject({
			providerId: 'pinned-provider',
			model: 'pinned-model',
			effort: 'high',
			scope,
		});
	});

	it.each([
		{ subtype: 'error_max_turns' as const, stopReason: 'max_iterations', status: 'failed' },
		{ subtype: 'success' as const, stopReason: 'budget_exhausted', status: 'exhausted' },
	])('preserves terminal $status outcomes', async ({ subtype, stopReason, status }) => {
		mockStream.mockReturnValue(
			(async function* () {
				yield { type: 'assistant_message', content: 'draft', toolCalls: [] };
				yield {
					type: 'run_finished',
					result: {
						text: 'canonical result',
						model: 'test-model',
						toolCalls: [{ id: 'tool', name: 'read', args: {}, result: { content: 'ok' } }],
						numTurns: 1,
						subtype,
						sessionId: 'child',
						stopReason,
					},
				};
			})()
		);
		const tool = subagentTool({ location: '/agent' }, [], {
			type: 'default',
			interactionMode: 'default',
		});

		await expect(tool.run({ task: 'inspect' })).resolves.toMatchObject({
			status,
			text: 'canonical result',
			stopReason,
			result: { sessionId: 'child', toolCalls: [expect.objectContaining({ id: 'tool' })] },
		});
	});
});
