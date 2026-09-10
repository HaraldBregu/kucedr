import type {
	AgentPromptInputCapabilities,
	ModelReasoningEffort,
} from '../../../shared/agent_types';
import type { PromptAttachmentBlock } from '../attachments';
import type { RunContext } from '../context';
import type { Message, MessageContentBlock, ToolCall } from '../types';

export const DEFAULT_CATEGORY: SessionCategory = 'main';

export type SessionCategory = 'main' | 'bot' | 'health' | 'task' | 'subagent' | 'voice';

export type SessionResultSubtype = 'success' | 'error_max_turns';

export interface SessionUsage {
	inputTokens: number;
	outputTokens: number;
}

export interface SessionResult {
	text: string;
	model: string;
	toolCalls: ToolCall[];
	numTurns: number;
	subtype: SessionResultSubtype;
	sessionId: string;
	stopReason?: string;
	usage?: SessionUsage;
}

export interface SessionInput {
	task: string;
	message: string;
	files?: PromptAttachmentBlock[];
	promptCapabilities?: AgentPromptInputCapabilities;
	deferPersist?: boolean;
	sessionId?: string;
	legacySessionId?: string;
	messages?: Message[];
	model?: string;
	effort?: ModelReasoningEffort;
	maxTurns?: number;
	maxIterations?: number;
}

export interface SessionTurn {
	content: string;
	model: string;
	stopReason?: string;
	toolCalls: ToolCall[];
	providerItems?: MessageContentBlock[];
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
	};
}

export interface SessionLease {
	active: boolean;
	messages: Message[];
	signal: AbortSignal;
	release(): void;
}

export interface SessionState {
	pendingMessages?: Message[];
	lease?: SessionLease;
	id: string;
	category: SessionCategory;
	messages: Message[];
	toolCalls: ToolCall[];
	usage: SessionUsage;
	maxTurns: number;
	model: string;
	numTurns: number;
	finalText: string;
	stopReason?: string;
	sessionsPath: string;
	folderName: string;
	runTraceBuffer: string[];
	runContext: RunContext;
}
