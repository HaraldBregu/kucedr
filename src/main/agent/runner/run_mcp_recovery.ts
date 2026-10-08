import { addAssistantMessage, addToolResults, type SessionState } from '../session';
import type { FileAccessContext } from '../context';
import type { FileHistory } from '../history/types';
import type { KeyedMutex } from '../mutex';
import type { RuntimeEvent, Tool, ToolCall } from '../types';
import { requestMcpAuthorizationTool } from '../tools/mcp/authorize';
import { mcpAuthorizationStopped } from './mcp_authorization_stopped';
import { runToolCalls } from './run_tool_calls';
import { skipToolCalls } from './skip';
import type { ToolCallSecurityContext } from './run_tool_call';

interface RecoveryInput {
	session: SessionState;
	failedCall: ToolCall;
	failedTool: Tool | undefined;
	pendingCalls: ToolCall[];
	signal: AbortSignal;
	context: FileAccessContext;
	security: ToolCallSecurityContext;
	resources?: KeyedMutex;
	history?: FileHistory;
}

export async function* runMcpRecovery({
	session,
	failedCall,
	failedTool,
	pendingCalls,
	signal,
	context,
	security,
	resources,
	history,
}: RecoveryInput): AsyncGenerator<RuntimeEvent, 'cancelled' | 'retried'> {
	const required = failedCall.result?.authorizationRequired;
	if (!required) throw new Error('MCP authorization request was lost.');
	yield* skipToolCalls(
		pendingCalls.filter((call) => !call.result),
		'Waiting for MCP authorization; remaining tools were not run.'
	);
	addToolResults(session, pendingCalls);
	const authorizationCall: ToolCall = {
		id: crypto.randomUUID(),
		name: 'request_mcp_authorization',
		args: {
			serverId: required.serverId,
			serverName: required.serverName,
			force: true,
			toolName: failedTool?.name,
		},
	};
	addAssistantMessage(session, '', [authorizationCall]);
	yield* runToolCalls(
		[requestMcpAuthorizationTool()],
		[authorizationCall],
		signal,
		context,
		security,
		resources,
		history
	);
	addToolResults(session, [authorizationCall]);
	if (mcpAuthorizationStopped(authorizationCall) || authorizationCall.result?.isError) return 'cancelled';

	const retryCall: ToolCall = {
		id: crypto.randomUUID(),
		name: failedCall.name,
		args: { ...failedCall.args },
	};
	addAssistantMessage(session, '', [retryCall]);
	yield* runToolCalls(
		failedTool ? [failedTool] : [],
		[retryCall],
		signal,
		context,
		security,
		resources,
		history
	);
	addToolResults(session, [retryCall]);
	return 'retried';
}
