import type { AgentHistoryMessage, AgentResponseEvent, AgentToolCallStatus } from '@/lib/compat';
import type { AgentChatAction } from './actions';
import {
	applyAgentResponseEventToTools,
	type AgentToolPart,
	agentToolPartFromHistoryBlock,
	updateAgentToolPart,
} from './tool-parts';
import {
	initialAgentChatState,
	welcomeMessage,
	type AgentChatState,
	type AgentMessage,
	type HomeChatMessage,
	type UserMessage,
} from './state';

function isAgentMessage(message: HomeChatMessage): message is AgentMessage {
	return message.role === 'agent' && message.type === 'agent';
}

function createUserMessage(id: string, content: string): UserMessage {
	return {
		id,
		role: 'user',
		type: 'user',
		content,
	};
}

function createAgentMessage(id: string, runId?: string, startedAtMs?: number): AgentMessage {
	return {
		id,
		role: 'agent',
		type: 'agent',
		content: '',
		runId,
		state: 'thinking',
		tools: [],
		startedAtMs,
	};
}

function updateAgentMessage(
	state: AgentChatState,
	messageId: string,
	update: (message: AgentMessage) => AgentMessage
): AgentChatState {
	return {
		...state,
		messages: state.messages.map((message) =>
			message.id === messageId && isAgentMessage(message) ? update(message) : message
		),
	};
}

function activeAgent(state: AgentChatState): AgentMessage | undefined {
	return state.messages.find(
		(message) => message.id === state.activeAgentId && isAgentMessage(message)
	) as AgentMessage | undefined;
}

function ensureAgentForRun(
	state: AgentChatState,
	runId: string
): { state: AgentChatState; message: AgentMessage } {
	const current = activeAgent(state);
	if (current) {
		if (current.runId && current.runId !== runId) return { state, message: current };
		const nextMessage = current.runId ? current : { ...current, runId };
		if (nextMessage === current) return { state, message: current };
		const nextState = updateAgentMessage(state, current.id, () => nextMessage);
		return { state: { ...nextState, activeRunId: runId }, message: nextMessage };
	}

	const existing = state.messages.find(
		(message) => isAgentMessage(message) && message.runId === runId
	) as AgentMessage | undefined;
	if (existing) {
		return {
			state: { ...state, activeAgentId: existing.id, activeRunId: runId },
			message: existing,
		};
	}

	const message = createAgentMessage(`agent-${runId}`, runId);
	return {
		state: {
			...state,
			messages: [...state.messages, message],
			activeAgentId: message.id,
			activeRunId: runId,
		},
		message,
	};
}

function isTerminalRunState(state: AgentMessage['state']): boolean {
	return state === 'completed' || state === 'cancelled' || state === 'error';
}

function settleRunningTools(
	tools: readonly AgentToolPart[],
	failed = false
): AgentToolPart[] {
	return tools.map((tool) =>
		tool.state === 'input-streaming' || tool.state === 'input-available'
			? failed
				? { ...tool, state: 'output-error' as const, status: 'error' as const }
				: { ...tool, state: 'output-available' as const }
			: tool
	);
}

function applyResponseEvent(
	state: AgentChatState,
	event: AgentResponseEvent,
	receivedAtMs: number
): AgentChatState {
	if (state.activeRunId && state.activeRunId !== event.runId) return state;
	const ensured = ensureAgentForRun(state, event.runId);
	if (ensured.message.runId && ensured.message.runId !== event.runId) return state;

	if (event.type === 'run_state') {
		return updateAgentMessage(ensured.state, ensured.message.id, (message) => ({
			...message,
			runId: event.runId,
			state: event.state,
			errorText: event.state === 'error' ? (event.label ?? message.errorText) : message.errorText,
			startedAtMs: message.startedAtMs ?? receivedAtMs,
			completedAtMs: isTerminalRunState(event.state) ? receivedAtMs : message.completedAtMs,
		}));
	}

	if (event.type === 'run_started') return ensured.state;

	if (event.type === 'reasoning_summary') {
		return ensured.state;
	}

	if (event.type === 'tool_permission_request') {
		return updateAgentMessage(
			{ ...ensured.state, activeAgentId: ensured.message.id, activeRunId: event.runId },
			ensured.message.id,
			(message) => ({
				...message,
				runId: event.runId,
				pendingPermission: {
					approvalId: event.approvalId,
					runId: event.runId,
					toolCallId: event.toolCallId,
					toolName: event.toolName,
					inputFingerprint: event.inputFingerprint,
					input: event.input,
					targets: event.targets,
					reason: event.reason,
					persistable: event.persistable,
					allowOnce: event.allowOnce,
					expiresAt: event.expiresAt,
				},
				startedAtMs: message.startedAtMs ?? receivedAtMs,
			})
		);
	}

	if (event.type === 'user_input_request') {
		return updateAgentMessage(
			{ ...ensured.state, activeAgentId: ensured.message.id, activeRunId: event.runId },
			ensured.message.id,
			(message) => {
				const type = message.tools.find((tool) => tool.toolCallId === event.toolCallId)?.type;
				return {
					...message,
					state: 'awaiting_input',
					tools: updateAgentToolPart(message.tools, event.toolCallId, {
						type: type === 'select_screen_source' ? 'select_screen_source' : 'ask',
						state: 'input-available',
						input: { questions: event.questions },
					}),
					pendingUserInput: {
						requestId: event.requestId,
						runId: event.runId,
						toolCallId: event.toolCallId,
						inputFingerprint: event.inputFingerprint,
						questions: event.questions,
						expiresAt: event.expiresAt,
					},
				};
			}
		);
	}

	if (event.type === 'user_input_result') {
		return updateAgentMessage(ensured.state, ensured.message.id, (message) => {
			const screenSource =
				message.tools.find((tool) => tool.toolCallId === event.toolCallId)?.type ===
				'select_screen_source';
			const output = screenSource
				? {
					status: event.status,
					sourceId: event.answers.find((answer) => answer.questionId === 'screen-source')?.answer,
				}
				: { status: event.status, answers: event.answers };
			return {
				...message,
				pendingUserInput: undefined,
				tools: updateAgentToolPart(message.tools, event.toolCallId, {
					type: screenSource ? 'select_screen_source' : 'ask',
					state: event.status === 'resolved' ? 'output-available' : 'output-error',
					output,
					outputText: JSON.stringify(output),
				}),
			};
		});
	}

	if (event.type === 'model_usage') {
		const turnOutputTokens = event.usage?.outputTokens;
		const nextState =
			turnOutputTokens === undefined
				? ensured.state
				: updateAgentMessage(ensured.state, ensured.message.id, (message) => ({
						...message,
						settledOutputTokens: (message.settledOutputTokens ?? 0) + turnOutputTokens,
						streamedChars: 0,
					}));
		return { ...nextState, pendingTurnOutputTokens: turnOutputTokens };
	}

	if (event.type === 'run_finished') {
		if (!event.usage) return ensured.state;
		return updateAgentMessage(ensured.state, ensured.message.id, (message) => ({
			...message,
			inputTokens: event.usage?.inputTokens ?? message.inputTokens,
			outputTokens: event.usage?.outputTokens ?? message.outputTokens,
		}));
	}

	if (event.type === 'text_delta') {
		if (!event.delta) return ensured.state;
		return updateAgentMessage(
			{ ...ensured.state, activeAgentId: ensured.message.id, activeRunId: event.runId },
			ensured.message.id,
			(message) => ({
				...message,
				runId: event.runId,
				state: 'answering',
				content: message.content + event.delta,
				streamedChars: (message.streamedChars ?? 0) + event.delta.length,
				startedAtMs: message.startedAtMs ?? receivedAtMs,
			})
		);
	}

	const tools = applyAgentResponseEventToTools(
		ensured.message.tools,
		event,
		ensured.state.pendingTurnOutputTokens,
		receivedAtMs
	);
	if (!tools) return ensured.state;

	return updateAgentMessage(
		{ ...ensured.state, activeAgentId: ensured.message.id, activeRunId: event.runId },
		ensured.message.id,
		(message) => ({
			...message,
			runId: event.runId,
			state: 'using_tools',
			tools,
			pendingPermission:
				event.type === 'tool_call_result' &&
				message.pendingPermission?.toolCallId === event.toolCallId
					? undefined
					: message.pendingPermission,
			content: event.type === 'tool_call_start' ? '' : message.content,
			streamedChars:
				event.type === 'tool_call_args_delta'
					? (message.streamedChars ?? 0) + event.jsonDelta.length
					: message.streamedChars,
			startedAtMs: message.startedAtMs ?? receivedAtMs,
		})
	);
}

function addToolResultToMessages(
	messages: readonly HomeChatMessage[],
	toolUseId: string | undefined,
	content: string | null | undefined,
	isError: boolean | undefined,
	status: AgentToolCallStatus | undefined,
	output: unknown
): HomeChatMessage[] {
	if (!toolUseId) return [...messages];
	const resolvedStatus: AgentToolCallStatus = status ?? (isError ? 'error' : 'ok');
	const hasError = resolvedStatus !== 'ok';
	const errorText =
		hasError && content
			? content
			: hasError
				? resolvedStatus === 'rejected'
					? 'Tool call was rejected.'
					: 'Tool call failed.'
				: undefined;

	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (!isAgentMessage(message)) continue;
		if (!message.tools.some((tool) => tool.toolCallId === toolUseId)) continue;

		const nextMessage: AgentMessage = {
			...message,
			tools: updateAgentToolPart(message.tools, toolUseId, {
				state: hasError ? 'output-error' : 'output-available',
				output: output ?? content ?? '',
				outputText: content ?? '',
				errorText,
				status: resolvedStatus,
			}),
		};

		return messages.map((current, currentIndex) =>
			currentIndex === index ? nextMessage : current
		);
	}

	return [...messages];
}

export function historyToChatMessages(history: AgentHistoryMessage[]): HomeChatMessage[] {
	const out: HomeChatMessage[] = [];
	history.forEach((message, index) => {
		if (message.role === 'tool') {
			const next = addToolResultToMessages(
				out,
				message.toolUseId,
				message.content,
				message.isError,
				message.status,
				message.output
			);
			out.splice(0, out.length, ...next);
			return;
		}

		if (message.role === 'user') {
			const content = typeof message.content === 'string' ? message.content : '';
			if (content.length > 0) out.push(createUserMessage(`user-history-${index}`, content));
			return;
		}

		if (message.role !== 'assistant') return;
		const content = typeof message.content === 'string' ? message.content : '';
		const tools = (message.contentBlocks ?? [])
			.map((block) => agentToolPartFromHistoryBlock(block, message.usage?.outputTokens))
			.filter((tool): tool is AgentToolPart => Boolean(tool));

		if (content.length === 0 && tools.length === 0) return;

		const last = out[out.length - 1];
		if (last && isAgentMessage(last)) {
			out[out.length - 1] = {
				...last,
				content:
					last.content.length > 0 && content.length > 0
						? `${last.content}\n\n${content}`
						: last.content + content,
				tools: [...last.tools, ...tools],
				inputTokens: (last.inputTokens ?? 0) + (message.usage?.inputTokens ?? 0),
				outputTokens: (last.outputTokens ?? 0) + (message.usage?.outputTokens ?? 0),
			};
			return;
		}

		out.push({
			id: `agent-history-${index}`,
			role: 'agent',
			type: 'agent',
			content,
			state: 'completed',
			tools,
			inputTokens: message.usage?.inputTokens,
			outputTokens: message.usage?.outputTokens,
		});
	});
	return out.map((message) => {
		if (!isAgentMessage(message)) return message;
		return {
			...message,
			tools: settleRunningTools(
				message.tools.map((tool) =>
					tool.type === 'ask' && tool.state === 'input-available'
						? {
								...tool,
								state: 'output-error' as const,
								output: { status: 'interrupted', answers: [] },
								outputText: JSON.stringify({ status: 'interrupted', answers: [] }),
							}
						: tool
				),
				true
			),
		};
	});
}

export function agentChatReducer(state: AgentChatState, action: AgentChatAction): AgentChatState {
	switch (action.type) {
		case 'submit_user_message': {
			const agentMessage = createAgentMessage(
				action.agentMessageId,
				undefined,
				action.submittedAtMs
			);
			return {
				messages: [
					...state.messages,
					...(action.content ? [createUserMessage(action.userMessageId, action.content)] : []),
					agentMessage,
				],
				activeAgentId: agentMessage.id,
			};
		}
		case 'append_user_message':
			return {
				...state,
				messages: [...state.messages, createUserMessage(action.messageId, action.content)],
			};
		case 'update_user_message':
			return {
				...state,
				messages: state.messages.map((message) =>
					message.id === action.messageId && message.role === 'user'
						? { ...message, content: action.content }
						: message
				),
			};
		case 'start_voice_turn': {
			const previous = activeAgent(state);
			const messages = previous
				? state.messages.map((message) =>
						message.id === previous.id && isAgentMessage(message)
							? { ...message, state: 'completed' as const, completedAtMs: action.startedAtMs }
							: message
					)
				: state.messages;
			const userMessage = createUserMessage(action.userMessageId, action.content);
			const agentMessage = createAgentMessage(
				action.agentMessageId,
				action.runId,
				action.startedAtMs
			);
			return {
				...state,
				messages: [...messages, userMessage, agentMessage],
				activeAgentId: agentMessage.id,
				activeRunId: action.runId,
			};
		}
		case 'apply_response_event':
			return applyResponseEvent(state, action.event, action.receivedAtMs);
		case 'complete_active': {
			const current = activeAgent(state);
			if (!current) {
				if (action.response.trim().length === 0) return state;
				const message: AgentMessage = {
					...createAgentMessage(`agent-completed-${Date.now()}`, undefined, action.completedAtMs),
					content: action.response,
					state: 'completed',
					completedAtMs: action.completedAtMs,
				};
				return { ...state, messages: [...state.messages, message] };
			}

			const nextState = updateAgentMessage(state, current.id, (message) => ({
				...message,
				content: message.content.trim().length > 0 ? message.content : action.response,
				state:
					message.state === 'error' || message.state === 'cancelled' ? message.state : 'completed',
				pendingPermission: undefined,
				pendingUserInput: undefined,
				tools: settleRunningTools(message.tools),
				startedAtMs: message.startedAtMs ?? action.completedAtMs,
				completedAtMs: action.completedAtMs ?? message.completedAtMs,
			}));
			return { ...nextState, activeAgentId: undefined, activeRunId: undefined };
		}
		case 'cancel_active': {
			const current = activeAgent(state);
			if (!current) return state;
			const nextState = updateAgentMessage(state, current.id, (message) => ({
				...message,
				state: 'cancelled',
				errorText: 'Cancelled.',
				pendingPermission: undefined,
				pendingUserInput: undefined,
				tools: settleRunningTools(
					message.pendingUserInput
						? updateAgentToolPart(message.tools, message.pendingUserInput.toolCallId, {
								type: 'ask',
								state: 'output-error',
								output: { status: 'interrupted', answers: [] },
								outputText: JSON.stringify({ status: 'interrupted', answers: [] }),
							})
						: message.tools,
					true
				),
				startedAtMs: message.startedAtMs ?? action.completedAtMs,
				completedAtMs: action.completedAtMs ?? message.completedAtMs,
			}));
			return { ...nextState, activeAgentId: undefined, activeRunId: undefined };
		}
		case 'error_active': {
			const current = activeAgent(state);
			if (!current) {
				const message: AgentMessage = {
					...createAgentMessage(`agent-error-${Date.now()}`, undefined, action.completedAtMs),
					content: action.errorText,
					state: 'error',
					errorText: action.errorText,
					completedAtMs: action.completedAtMs,
				};
				return { ...state, messages: [...state.messages, message] };
			}

			const nextState = updateAgentMessage(state, current.id, (message) => ({
				...message,
				content: message.content || action.errorText,
				state: 'error',
				errorText: action.errorText,
				pendingPermission: undefined,
				pendingUserInput: undefined,
				tools: settleRunningTools(message.tools, true),
				startedAtMs: message.startedAtMs ?? action.completedAtMs,
				completedAtMs: action.completedAtMs ?? message.completedAtMs,
			}));
			return { ...nextState, activeAgentId: undefined, activeRunId: undefined };
		}
		case 'restore_history': {
			const restored = historyToChatMessages(action.history);
			return {
				messages: restored.length > 0 ? [welcomeMessage, ...restored] : [welcomeMessage],
				activeAgentId: undefined,
				activeRunId: undefined,
			};
		}
		case 'reset':
			return initialAgentChatState;
	}
}
