import {
	addAssistantMessage,
	addToolResults,
	createSessionState,
	init,
	insertUserMessage,
	SessionCoordinator,
	releaseSession,
} from '../session';
import { randomUUID } from 'node:crypto';
import type { Config, ToolCall } from '../types';
import type { RealtimeVoiceHistoryMessage } from '../../models/adapters/realtime_voice';
import { realtimeVoiceHistory } from './history';
import { loadMessagesBySessionId } from '../session/session_load_messages_by_session_id';

export interface RealtimeVoiceConversation {
	readonly signal?: AbortSignal;
	dispose?(): void;
	readonly history: readonly RealtimeVoiceHistoryMessage[];
	beginUserTurn(itemId: string): void;
	finalizeUserTurn(itemId: string, transcript: string): void;
	addAssistantTranscript(transcript: string): void;
	addToolCall(toolCall: ToolCall): void;
	addToolResult(toolCall: ToolCall): void;
}

interface PendingUserTurn {
	index: number;
	begun: boolean;
	transcript?: string;
}

export type RealtimeVoiceConversationFactory = (
	chatSessionId: string,
	modelId: string
) => RealtimeVoiceConversation;

export function realtimeVoiceConversationFactory(
	config: Config,
	coordinator = new SessionCoordinator()
): RealtimeVoiceConversationFactory {
	return (chatSessionId, modelId) => {
		const state = createSessionState();
		const voiceSessionId = randomUUID();
		const pendingUserTurns = new Map<string, PendingUserTurn>();
		init(
			state,
			config,
			{ task: 'voice', message: '', sessionId: voiceSessionId, model: modelId },
			'voice',
			coordinator
		);
		const contextMessages = loadMessagesBySessionId(chatSessionId, config.location);
		const toolCalls = new Map<string, ToolCall>();
		const completedToolCalls = new Set<string>();
		for (const message of state.messages) {
			for (const toolCall of message.toolCalls ?? []) {
				toolCalls.set(toolCall.id, toolCall);
				if (toolCall.result) completedToolCalls.add(toolCall.id);
			}
		}
		return {
			signal: state.lease?.signal,
			dispose: () => releaseSession(state),
			history: realtimeVoiceHistory(contextMessages),
			beginUserTurn: (itemId) => {
				if (state.lease && !state.lease.active) return;
				const turn = pendingUserTurns.get(itemId) ?? {
					index: state.messages.length,
					begun: false,
				};
				if (turn.begun) return;
				turn.begun = true;
				pendingUserTurns.set(itemId, turn);
				if (!turn.transcript) return;
				insertUserMessage(state, turn.index, turn.transcript);
				pendingUserTurns.delete(itemId);
				for (const pending of pendingUserTurns.values()) {
					if (pending.index >= turn.index) pending.index += 1;
				}
			},
			finalizeUserTurn: (itemId, transcript) => {
				if (state.lease && !state.lease.active) return;
				const turn = pendingUserTurns.get(itemId) ?? {
					index: state.messages.length,
					begun: false,
				};
				turn.transcript = transcript;
				pendingUserTurns.set(itemId, turn);
				if (!turn.begun) return;
				insertUserMessage(state, turn.index, transcript);
				pendingUserTurns.delete(itemId);
				for (const pending of pendingUserTurns.values()) {
					if (pending.index >= turn.index) pending.index += 1;
				}
			},
			addAssistantTranscript: (transcript) => addAssistantMessage(state, transcript, []),
			addToolCall: (toolCall) => {
				if (state.lease && !state.lease.active) return;
				if (toolCalls.has(toolCall.id)) return;
				toolCalls.set(toolCall.id, toolCall);
				addAssistantMessage(state, '', [toolCall]);
			},
			addToolResult: (toolCall) => {
				if (state.lease && !state.lease.active) return;
				if (!toolCall.result || completedToolCalls.has(toolCall.id)) return;
				let persisted = toolCalls.get(toolCall.id);
				if (!persisted) {
					persisted = toolCall;
					toolCalls.set(toolCall.id, persisted);
					addAssistantMessage(state, '', [persisted]);
				} else if (persisted !== toolCall) {
					persisted.name = toolCall.name;
					persisted.args = toolCall.args;
					persisted.result = toolCall.result;
				}
				completedToolCalls.add(toolCall.id);
				addToolResults(state, [persisted]);
			},
		};
	};
}
