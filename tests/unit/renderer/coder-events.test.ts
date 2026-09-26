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
