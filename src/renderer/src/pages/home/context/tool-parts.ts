import type { ToolPart } from '@/components/prompt-kit/tool';
import type {
	AgentHistoryContentBlock,
	AgentResponseEvent,
	AgentToolCallStatus,
} from '@/lib/compat';

export type AgentToolPart = ToolPart & {
	toolCallId: string;
	status?: AgentToolCallStatus;
	outputTokens?: number;
	startedAtMs?: number;
};

type AgentToolPartPatch = Omit<Partial<AgentToolPart>, 'toolCallId'>;

function createAgentToolPart(
	toolCallId: string,
	patch: AgentToolPartPatch
): AgentToolPart {
	return {
		toolCallId,
		type: patch.type ?? 'tool',
		state: patch.state ?? 'input-streaming',
		iteration: patch.iteration,
		input: patch.input,
		inputText: patch.inputText,
		output: patch.output,
		outputText: patch.outputText,
		durationMs: patch.durationMs,
		errorText: patch.errorText,
		status: patch.status,
		outputTokens: patch.outputTokens,
		startedAtMs: patch.startedAtMs,
	};
}

export function updateAgentToolPart(
	tools: readonly AgentToolPart[],
	toolCallId: string,
	patch: AgentToolPartPatch
): AgentToolPart[] {
	const index = tools.findIndex((tool) => tool.toolCallId === toolCallId);
	if (index === -1) {
		return [...tools, createAgentToolPart(toolCallId, patch)];
	}

	return tools.map((tool, currentIndex) =>
		currentIndex === index ? { ...tool, ...patch, toolCallId } : tool
	);
}

export function applyAgentResponseEventToTools(
	tools: readonly AgentToolPart[],
	event: AgentResponseEvent,
	outputTokens?: number,
	receivedAtMs?: number
): AgentToolPart[] | undefined {
	switch (event.type) {
		case 'capability_resolution_start':
		case 'capability_resolution_result':
		case 'run_state':
		case 'run_started':
		case 'reasoning_summary':
		case 'text_delta':
		case 'user_input_request':
		case 'user_input_result':
			return undefined;
		case 'tool_call_start':
			if (event.toolName === 'discover_tools') return undefined;
			return updateAgentToolPart(tools, event.toolCallId, {
				type: event.toolName,
				state: 'input-streaming',
				iteration: event.iteration,
				inputText: '',
				outputTokens,
			});
		case 'tool_call_args_delta':
			if (event.toolName === 'discover_tools') return undefined;
			return updateAgentToolPart(tools, event.toolCallId, {
				type: event.toolName,
				displayName: event.displayName,
				serviceKind: event.serviceKind,
				serviceId: event.serviceId,
				state: 'input-streaming',
				iteration: event.iteration,
				inputText: event.argsText,
			});
		case 'tool_call_input':
			if (event.toolName === 'discover_tools') return undefined;
			return updateAgentToolPart(tools, event.toolCallId, {
				type: event.toolName,
				displayName: event.displayName,
				serviceKind: event.serviceKind,
				serviceId: event.serviceId,
				state: 'input-available',
				iteration: event.iteration,
				input: event.input,
				inputText: event.argsText,
				startedAtMs: receivedAtMs,
			});
		case 'tool_call_result': {
			if (event.toolName === 'discover_tools') return undefined;
			const isError = event.status !== 'ok';
			const errorText =
				event.errorText ?? (isError ? event.outputText || 'Tool call failed.' : undefined);

			return updateAgentToolPart(tools, event.toolCallId, {
				type: event.toolName,
				state: isError ? 'output-error' : 'output-available',
				iteration: event.iteration,
				input: event.input,
				output: event.output,
				outputText: event.outputText,
				durationMs: event.durationMs,
				errorText,
				status: event.status,
			});
		}
		default:
			return undefined;
	}
}

export function agentToolPartFromHistoryBlock(
	block: AgentHistoryContentBlock,
	outputTokens?: number
): AgentToolPart | undefined {
	if (block.type !== 'tool_use') return undefined;

	return {
		toolCallId: block.toolUseId,
		type: block.toolName,
		state: 'input-available',
		input: block.toolArgs ?? {},
		outputTokens,
	};
}
