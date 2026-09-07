export type ModelReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export type AgentInteractionMode = 'default' | 'plan';

export type AgentRunState =
	| 'idle'
	| 'thinking'
	| 'reasoning'
	| 'using_tools'
	| 'awaiting_input'
	| 'answering'
	| 'completed'
	| 'cancelled'
	| 'error';

export type ReasoningSummaryState = 'pending' | 'running' | 'completed' | 'error';

export type AgentRunStopReason =
	| 'end_turn'
	| 'max_tokens'
	| 'max_iterations'
	| 'max_tool_calls'
	| 'budget_exhausted'
	| 'timeout'
	| 'error'
	| 'cancelled';

export type AgentToolResultStatus = 'ok' | 'error' | 'blocked' | 'rejected';

export type AgentToolPermissionDecision = 'approve' | 'reject' | 'approve_always';

export interface AgentToolPermissionScope {
	approvalId: string;
	runId: string;
	toolName: string;
	inputFingerprint: string;
}

export interface AgentUserInputOption {
	label: string;
	description: string;
}

export interface AgentUserInputQuestion {
	id: string;
	header: string;
	question: string;
	options: AgentUserInputOption[];
}

export interface AgentUserInputAnswer {
	questionId: string;
	answer: string;
}

export interface AgentUserInputScope {
	requestId: string;
	runId: string;
	toolCallId: string;
	inputFingerprint: string;
}

export type AgentRunType = 'default' | 'background';

export type AgentContextMode = 'minimal' | 'workspace';

export type AgentToolRisk = 'low' | 'medium' | 'high' | 'critical';

export type AgentToolEffect =
	| 'read'
	| 'write'
	| 'execute'
	| 'external'
	| 'sensor'
	| 'paid'
	| 'persistence';

export type AgentMediaModelKind =
	| 'image'
	| 'audio'
	| 'video'
	| 'voice'
	| 'realtimeVoice'
	| 'transcription';

export interface AgentMediaModelSettings {
	providerId: string;
	modelId: string;
	options: Record<string, unknown>;
}

export interface AgentInputFile {
	name: string;
	mimeType: string;
	data: string;
}

export interface AgentPromptInputLimits {
	maxFiles: number;
	maxBinaryBytes: number;
	maxBinaryTotalBytes: number;
	maxTextBytes: number;
	maxTextTotalBytes: number;
}

export interface AgentPromptInputCapabilities {
	rules: import('./model_types').PromptAttachmentRule[];
	accept: string;
	limits: AgentPromptInputLimits;
}

export interface AgentRunOptions {
	runId?: string;
	sessionId?: string;
	replyTo?: string;
	providerId?: string;
	model?: string;
	effort?: ModelReasoningEffort;
	contextMode?: AgentContextMode;
	interactionMode?: AgentInteractionMode;
	toolsAllow?: string[];
	toolsDeny?: string[];
	files?: AgentInputFile[];
	/** @deprecated Use contextMode. */
	lightContext?: boolean;
}

export interface WorkspaceChangeEvent {
	type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
	path: string;
}

export interface WorkspaceTreeEntry {
	name: string;
	path: string;
	type: 'file' | 'directory';
	children?: WorkspaceTreeEntry[];
	size?: number;
	createdAt?: string;
	updatedAt?: string;
}

export interface AgentTokenUsage {
	inputTokens?: number;
	outputTokens?: number;
}

export type AgentHistoryContentBlock =
	| {
			type: 'text';
			text: string;
	  }
	| {
			type: 'tool_use';
			toolUseId: string;
			toolName: string;
			toolArgs?: unknown;
	  }
	| {
			type: 'attachment';
			kind: 'text' | 'image' | 'document';
			name: string;
			mimeType: string;
			bytes: number;
	  };

export interface AgentHistoryMessage {
	role: 'user' | 'agent' | 'assistant' | 'tool';
	content?: string | null;
	blocks?: AgentHistoryContentBlock[];
	contentBlocks?: AgentHistoryContentBlock[];
	toolUseId?: string;
	isError?: boolean;
	status?: AgentToolResultStatus;
	output?: unknown;
	usage?: AgentTokenUsage;
}

export interface AgentSessionSummary {
	id: string;
	createdAtMs: number;
	title: string;
	runStatus?: 'queued' | 'running' | 'cancelling';
}

export interface AgentSessionSnapshot {
	messages: AgentHistoryMessage[];
	activeRun?: {
		runId: string;
		message: string;
		status: 'queued' | 'running' | 'cancelling';
		events: AgentResponseEvent[];
	};
}

export type AgentCapabilityServiceKind = 'tool' | 'connector' | 'mcp';

export interface AgentToolCapabilitySummary {
	name: string;
	displayName?: string;
	serviceKind: AgentCapabilityServiceKind;
	serviceId?: string;
}

export interface AgentSelectedSkillSummary {
	name: string;
	reason: string;
}

export type AgentIntentResolutionStatus = 'recognized' | 'ambiguous' | 'missing_slots' | 'unknown';

export interface AgentIntentAlternativeSummary {
	name: string;
	confidence?: number;
	reason?: string;
}

export interface AgentIntentSlotSummary {
	name: string;
	value?: unknown;
	missing?: boolean;
	reason?: string;
}

export interface AgentIntentResolutionSummary {
	name: string;
	status: AgentIntentResolutionStatus;
	confidence?: number;
	reason?: string;
	alternatives?: AgentIntentAlternativeSummary[];
	slots?: AgentIntentSlotSummary[];
}

export type AgentCapabilityDecisionMode =
	| 'direct_answer'
	| 'use_tools'
	| 'use_skills'
	| 'use_tools_and_skills';

export interface AgentCapabilityDecisionSummary {
	mode: AgentCapabilityDecisionMode;
	reason: string;
}

export interface AgentCapabilityServiceSummary {
	name: string;
	serviceKind: AgentCapabilityServiceKind;
	serviceId?: string;
	displayName?: string;
}

export interface AgentRouteResolutionSummary {
	target: AgentCapabilityDecisionMode;
	reason: string;
	serviceKinds?: AgentCapabilityServiceKind[];
	requiredApprovals?: string[];
}

export interface AgentCapabilityResolutionSummary {
	tools: string[];
	services?: AgentCapabilityServiceSummary[];
	skills: AgentSelectedSkillSummary[];
	directAnswer: boolean;
	decision: AgentCapabilityDecisionSummary;
	intent?: AgentIntentResolutionSummary;
	route?: AgentRouteResolutionSummary;
}

export type AgentRunStreamEvent =
	| { type: 'run_started'; sessionId: string; interactionMode: AgentInteractionMode }
	| { type: 'run_state'; state: AgentRunState; label?: string }
	| {
			type: 'model_selected';
			model: string;
			effort?: ModelReasoningEffort;
	  }
	| { type: 'model_usage'; usage?: AgentTokenUsage }
	| { type: 'capability_resolution_start' }
	| ({ type: 'capability_resolution_result' } & AgentCapabilityResolutionSummary)
	| {
			type: 'reasoning_summary';
			id: string;
			title: string;
			summary: string;
			state: ReasoningSummaryState;
	  }
	| { type: 'text_delta'; delta: string }
	| ({
			type: 'tool_call_start';
			iteration: number;
			toolCallId: string;
			toolName: string;
	  } & AgentToolCapabilitySummary)
	| ({
			type: 'tool_call_args_delta';
			iteration: number;
			toolCallId: string;
			toolName: string;
			jsonDelta: string;
			argsText: string;
	  } & Partial<AgentToolCapabilitySummary>)
	| ({
			type: 'tool_call_input';
			iteration: number;
			toolCallId: string;
			toolName: string;
			input: unknown;
			argsText: string;
	  } & Partial<AgentToolCapabilitySummary>)
	| {
			type: 'tool_permission_request';
			approvalId: string;
			toolCallId: string;
			toolName: string;
			input: unknown;
			mode: 'ask';
			targets: string[];
			reason: 'outside_trusted_location' | 'host_execution' | 'destructive_operation' | 'sensitive_operation';
			persistable: boolean;
			allowOnce: boolean;
			expiresAt: string;
			inputFingerprint: string;
			detail?: string;
	  }
	| {
			type: 'user_input_request';
			requestId: string;
			toolCallId: string;
			questions: AgentUserInputQuestion[];
			expiresAt: string;
			inputFingerprint: string;
	  }
	| {
			type: 'user_input_result';
			requestId: string;
			toolCallId: string;
			status: 'resolved' | 'interrupted';
			answers: AgentUserInputAnswer[];
	  }
	| ({
			type: 'tool_call_result';
			iteration: number;
			toolCallId: string;
			toolName: string;
			input: unknown;
			output: unknown;
			outputText: string;
			status: AgentToolResultStatus;
			durationMs: number;
			errorText?: string;
	  } & AgentToolCapabilitySummary)
	| {
			type: 'run_finished';
			stopReason: AgentRunStopReason;
			outputChars: number;
			usage?: AgentTokenUsage;
	  };

export type AgentResponseEvent = AgentRunStreamEvent & {
	agentId: string;
	runId: string;
};
