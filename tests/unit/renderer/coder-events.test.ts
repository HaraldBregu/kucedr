import { applyEvent } from '../../../src/renderer/src/coder/events';
import type { CoderBlock } from '../../../src/renderer/src/coder/types';

const context = { projectId: 'project-1', sessionId: 'session-1', runId: 'run-1' };

it('keeps assistant text around tool calls in order and records tool results', () => {
	let blocks: CoderBlock[] = [];
	blocks = applyEvent(blocks, { ...context, type: 'text-delta', delta: 'Reading ' }, '');
	blocks = applyEvent(blocks, { ...context, type: 'text-delta', delta: 'files.' }, '');
	blocks = applyEvent(
		blocks,
		{ ...context, type: 'tool-start', toolCallId: 'tool-1', toolName: 'read' },
		''
	);
	blocks = applyEvent(
		blocks,
		{ ...context, type: 'tool-end', toolCallId: 'tool-1', toolName: 'read', isError: true },
		''
	);
	blocks = applyEvent(blocks, { ...context, type: 'text-delta', delta: 'File unavailable.' }, '');
	expect(blocks).toEqual([
		expect.objectContaining({ type: 'message', role: 'assistant', content: 'Reading files.' }),
		expect.objectContaining({ type: 'tool', id: 'tool-1', status: 'failed' }),
		expect.objectContaining({ type: 'message', role: 'assistant', content: 'File unavailable.' }),
	]);
});

const base = { runId: 'run', projectId: 'project', sessionId: 'session' };
test('agent commands maintain separate blocks and route interleaved output by native ID', () => {
	let blocks = applyEvent(
		[],
		{ ...base, type: 'command-start', commandId: 'a', command: 'pwd' },
		'manual'
	);
	blocks = applyEvent(
		blocks,
		{ ...base, type: 'command-start', commandId: 'b', command: 'ls' },
		'manual'
	);
	blocks = applyEvent(
		blocks,
		{ ...base, type: 'command-output', commandId: 'b', delta: 'index.ts' },
		'manual'
	);
	blocks = applyEvent(
		blocks,
		{
			...base,
			type: 'command-end',
			commandId: 'a',
			exitCode: 0,
			cancelled: false,
			truncated: false,
		},
		'manual'
	);
	expect(blocks).toEqual([
		expect.objectContaining({ id: 'a', command: 'pwd', output: '', status: 'succeeded' }),
		expect.objectContaining({ id: 'b', command: 'ls', output: 'index.ts', status: 'running' }),
	]);
});
test('manual shell start reuses the optimistic block', () => {
	const blocks: CoderBlock[] = [
		{
			id: 'manual',
			type: 'command',
			command: 'pwd',
			output: '',
			status: 'running',
			truncated: false,
			timestamp: 'now',
		},
	];
	const started = applyEvent(blocks, { ...base, type: 'command-start', command: 'pwd' }, 'manual');
	expect(started).toBe(blocks);
	expect(
		applyEvent(started, { ...base, type: 'command-output', delta: '/workspace' }, 'manual')
	).toEqual([expect.objectContaining({ id: 'manual', output: '/workspace' })]);
});
