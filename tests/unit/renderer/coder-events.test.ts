import { applyEvent } from '../../../src/renderer/src/coder/events';
import type { CoderBlock } from '../../../src/renderer/src/coder/types';

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
