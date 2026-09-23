import type { RuntimeEvent, Tool, ToolCall } from '../types';

export function* recoverToolCalls(calls: ToolCall[], activated: Tool[]): Generator<RuntimeEvent> {
	const names = activated.map((tool) => tool.id).join(', ');
	const receipt = `Tool capabilities activated (${names}). Retry the entire batch using the now-available schemas; no arguments from this batch were executed.`;
	for (const call of calls) {
		call.result = { content: receipt };
		yield { type: 'tool_call_start', toolCallId: call.id, toolName: call.name, input: call.args };
		yield {
			type: 'tool_call_end',
			toolCallId: call.id,
			toolName: call.name,
			input: call.args,
			output: receipt,
			durationMs: 0,
		};
	}
}
