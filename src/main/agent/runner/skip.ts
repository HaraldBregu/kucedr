import type { RuntimeEvent, ToolCall } from '../types';

export function* skipToolCalls(calls: ToolCall[], reason: string): Generator<RuntimeEvent> {
	for (const call of calls) {
		call.result = { content: reason, isError: true };
		yield { type: 'tool_call_start', toolCallId: call.id, toolName: call.name, input: call.args };
		yield {
			type: 'tool_call_end',
			toolCallId: call.id,
			toolName: call.name,
			input: call.args,
			output: reason,
			isError: true,
			durationMs: 0,
		};
	}
}
