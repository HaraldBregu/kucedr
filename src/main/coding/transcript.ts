import type { CodingResponseEvent, CodingSessionBlock } from '../../shared/coding_types';
export type JournalEvent = {
	timestamp: string;
	event:
		| CodingResponseEvent
		| { type: 'prompt'; runId: string; input: string; mode: 'agent' | 'shell' }
		| { type: 'seed'; blocks: readonly CodingSessionBlock[] };
};

export function transcript(entries: readonly JournalEvent[]): CodingSessionBlock[] {
	let blocks: CodingSessionBlock[] = [];
	for (const { event, timestamp } of entries) {
		if (event.type === 'seed') {
			blocks = [...event.blocks];
			continue;
		}
		if (event.type === 'prompt') {
			if (event.mode === 'agent')
				blocks.push({
					id: event.runId + '-user',
					type: 'message',
					role: 'user',
					content: event.input,
					timestamp,
				});
		} else if (event.type === 'text-delta') {
			const last = blocks.at(-1);
			if (
				last?.type === 'message' &&
				last.role === 'assistant' &&
				last.id.startsWith(event.runId + ':')
			)
				blocks[blocks.length - 1] = { ...last, content: last.content + event.delta };
			else
				blocks.push({
					id: event.runId + ':' + blocks.length,
					type: 'message',
					role: 'assistant',
					content: event.delta,
					timestamp,
				});
		} else if (event.type === 'tool-start') {
			blocks.push({
				id: event.runId + ':' + event.toolCallId,
				type: 'tool',
				toolName: event.toolName,
				status: 'running',
				timestamp,
			});
		} else if (event.type === 'tool-end') {
			blocks = blocks.map((b) =>
				b.type === 'tool' && b.id === event.runId + ':' + event.toolCallId
					? { ...b, status: event.isError ? 'failed' : 'succeeded' }
					: b
			);
		} else if (event.type === 'command-start') {
			blocks.push({
				id: event.runId + ':command:' + (event.commandId ?? 'shell'),
				type: 'command',
				command: event.command,
				output: '',
				status: 'failed',
				truncated: false,
				timestamp,
			});
		} else if (event.type === 'command-output') {
			blocks = blocks.map((b) =>
				b.type === 'command' && b.id === event.runId + ':command:' + (event.commandId ?? 'shell')
					? { ...b, output: b.output + event.delta }
					: b
			);
		} else if (event.type === 'command-end') {
			blocks = blocks.map((b) =>
				b.type === 'command' && b.id === event.runId + ':command:' + (event.commandId ?? 'shell')
					? {
							...b,
							exitCode: event.exitCode,
							truncated: event.truncated,
							status: event.cancelled ? 'cancelled' : event.exitCode === 0 ? 'succeeded' : 'failed',
						}
					: b
			);
		} else if (event.type === 'interaction') {
			blocks.push({
				id: event.requestId,
				type: 'interaction',
				toolName: event.toolName,
				input: event.input,
				status: 'cancelled',
				timestamp,
			});
		} else if (event.type === 'interaction-resolved') {
			blocks = blocks.map((b) =>
				b.type === 'interaction' && b.id === event.requestId
					? { ...b, status: event.approved ? 'approved' : 'denied' }
					: b
			);
		}
	}
	return blocks.map((b) =>
		b.type === 'tool' && b.status === 'running' ? { ...b, status: 'failed' } : b
	);
}
