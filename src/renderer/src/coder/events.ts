import type { CodingResponseEvent } from '@shared/coding_types';
import type { CoderBlock } from './types';

export function applyEvent(
	blocks: CoderBlock[],
	event: CodingResponseEvent,
	commandId: string
): CoderBlock[] {
	if (event.type === 'text-delta') {
		const last = blocks.at(-1);
		if (last?.type === 'message' && last.role === 'assistant') {
			return [...blocks.slice(0, -1), { ...last, content: last.content + event.delta }];
		}
		return [
			...blocks,
			{
				id: crypto.randomUUID(),
				type: 'message',
				role: 'assistant',
				content: event.delta,
				timestamp: new Date().toISOString(),
			},
		];
	}
	if (event.type === 'tool-start')
		return [
			...blocks,
			{
				id: event.toolCallId,
				type: 'tool',
				toolName: event.toolName,
				status: 'running',
				timestamp: new Date().toISOString(),
			},
		];
	if (event.type === 'tool-end')
		return blocks.map((block) =>
			block.type === 'tool' && block.id === event.toolCallId
				? { ...block, status: event.isError ? 'failed' : 'succeeded' }
				: block
		);
	if (event.type === 'command-output')
		return blocks.map((block) =>
			block.type === 'command' && block.id === commandId
				? { ...block, output: block.output + event.delta }
				: block
		);
	if (event.type === 'command-end')
		return blocks.map((block) =>
			block.type === 'command' && block.id === commandId
				? {
						...block,
						status: event.cancelled ? 'cancelled' : event.exitCode === 0 ? 'succeeded' : 'failed',
						exitCode: event.exitCode,
						truncated: event.truncated,
					}
				: block
		);
	return blocks;
}
