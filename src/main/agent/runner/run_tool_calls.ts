import type { RuntimeEvent, Tool, ToolCall } from '../types';
import type { FileAccessContext } from '../context';
import { runToolCall, type ToolCallSecurityContext } from './run_tool_call';
import type { KeyedMutex } from '../mutex';
import type { FileHistory } from '../history/types';
import { mcpAuthorizationStopped } from './mcp_authorization_stopped';

export async function* runToolCalls(
	tools: Tool[],
	toolCalls: ToolCall[],
	signal?: AbortSignal,
	context?: FileAccessContext,
	security?: ToolCallSecurityContext,
	resources?: KeyedMutex,
	history?: FileHistory
): AsyncGenerator<RuntimeEvent, void> {
	for (const toolCall of toolCalls) {
		for await (const event of runToolCall(
			tools.find((tool) => tool.id === toolCall.name),
			toolCall,
			signal,
			context,
			security,
			resources,
			history
		)) {
			yield event;
		}
		if (signal?.aborted || mcpAuthorizationStopped(toolCall)) break;
	}
}
