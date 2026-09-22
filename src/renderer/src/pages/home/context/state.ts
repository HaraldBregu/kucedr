import type { AgentRunState, AgentUserInputQuestion, AgentUserInputScope } from '@/lib/compat';
import type { AgentToolPart } from './tool-parts';

export type { AgentRunState, AgentToolPart };

export interface UserMessage {
	readonly id: string;
	readonly role: 'user';
	readonly type: 'user';
	readonly content: string;
}

export interface PendingToolPermission {
	readonly approvalId: string;
	readonly runId: string;
	readonly toolCallId: string;
	readonly toolName: string;
	readonly inputFingerprint: string;
	readonly input: unknown;
	readonly targets: readonly string[];
	readonly reason:
		| 'outside_trusted_location'
		| 'host_execution'
		| 'destructive_operation'
		| 'sensitive_operation';
	readonly persistable: boolean;
	readonly allowOnce: boolean;
	readonly expiresAt: string;
}

export interface PendingUserInput extends AgentUserInputScope {
	readonly questions: readonly AgentUserInputQuestion[];
	readonly expiresAt: string;
}

export interface AgentMessage {
	readonly id: string;
	readonly role: 'agent';
	readonly type: 'agent';
	readonly content: string;
	readonly runId?: string;
	readonly state: AgentRunState;
	readonly tools: readonly AgentToolPart[];
	readonly pendingPermission?: PendingToolPermission;
	readonly pendingUserInput?: PendingUserInput;
	readonly errorText?: string;
	readonly startedAtMs?: number;
	readonly completedAtMs?: number;
	readonly inputTokens?: number;
	readonly outputTokens?: number;
	readonly settledOutputTokens?: number;
	readonly streamedChars?: number;
	readonly toolSelection?: {
		readonly state: 'selecting' | 'selected';
		readonly names: readonly string[];
	};
}

export type HomeChatMessage = UserMessage | AgentMessage;

export interface AgentChatState {
	readonly messages: readonly HomeChatMessage[];
	readonly activeAgentId?: string;
	readonly activeRunId?: string;
	readonly pendingTurnOutputTokens?: number;
}

export const welcomeMessage: AgentMessage = {
	id: 'agent-welcome',
	role: 'agent',
	type: 'agent',
	content:
		'Ready when you are. Ask Kucedr to inspect code, make a change, explain a file, or help plan the next step.',
	state: 'idle',
	tools: [],
};

export const initialAgentChatState: AgentChatState = {
	messages: [welcomeMessage],
};
