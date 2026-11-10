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
	history?: FileHistory,
	eligible: readonly Tool[] = []
): AsyncGenerator<RuntimeEvent, void> {
	for (const toolCall of toolCalls) {
		const tool =
			tools.find((candidate) => candidate.id === toolCall.name) ??
			(eligible.some((candidate) => candidate.id === toolCall.name) ? 'unloaded' : undefined);
		for await (const event of runToolCall(
			tool,
			toolCall,
			signal,
			context,
			security,
			resources,
			history
		)) {
			yield event;
		}
		if (
			signal?.aborted ||
			mcpAuthorizationStopped(toolCall) ||
			(security?.windowId !== undefined &&
				!security.extension?.restricted &&
				Boolean(toolCall.result?.authorizationRequired))
		) break;
	}
}
