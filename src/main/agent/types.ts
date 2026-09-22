import type { z } from 'zod';
import type { LlmEvent } from '../models/adapters/llm';
import type { SkillDiagnostic, SkillTrust } from '../../shared/skills_types';
import type { AgentToolReference, AgentToolProfileId } from '../../shared/agent_tools';

export interface Config {
	location: string;
}

export type MessageRole = 'system' | 'user' | 'assistant';

export interface ToolResult {
	content: MessageContent;
	isError?: boolean;
}

export interface ToolCall {
	id: string;
	name: string;
	args: Record<string, unknown>;
	result?: ToolResult;
}

export interface JSONSchema {
	type?: string;
	properties?: Record<string, unknown>;
	required?: string[];
	items?: unknown;
	description?: string;
	enum?: unknown[];
	additionalProperties?: boolean | unknown;
	[k: string]: unknown;
}

export interface Tool {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly schema: JSONSchema;
	readonly timeoutMs: number;
	readonly maxOutputBytes: number;
	readonly planSafe?: boolean;
	readonly hardApproval?: boolean | ((input: Record<string, unknown>) => boolean);
	readonly capability?:
		| import('./execution/capability').ToolCapability
		| ((
				input: Record<string, unknown>
		  ) => import('./execution/capability').ToolCapability | undefined);
	readonly policy?: AgentToolReference;
	parseInput(input: unknown): Record<string, unknown>;
	run(input: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> | unknown;
}

export type ToolConfig<T extends z.ZodType> = {
	id: string;
	name: string;
	description: string;
	timeoutMs?: number;
	maxOutputBytes?: number;
	planSafe?: boolean;
	hardApproval?: boolean | ((input: z.infer<T>) => boolean);
	capability?: import('./execution/capability').ToolCapability;
	policy?: AgentToolReference;
	inputSchema: T;
	execute: (input: z.infer<T>, signal?: AbortSignal) => Promise<unknown> | unknown;
};

export type JsonToolConfig = {
	id: string;
	name: string;
	description: string;
	timeoutMs?: number;
	maxOutputBytes?: number;
	planSafe?: boolean;
	hardApproval?: boolean | ((input: Record<string, unknown>) => boolean);
	capability?: import('./execution/capability').ToolCapability;
	policy?: AgentToolReference;
	parseInput?: (input: unknown) => Record<string, unknown>;
	schema: JSONSchema;
	execute: (input: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown> | unknown;
};

export interface MessageContentBlock {
	type: string;
	[key: string]: unknown;
}

export type MessageContent = string | MessageContentBlock[];

export interface Message {
	role: MessageRole;
	content: MessageContent;
	toolCalls?: ToolCall[];
	usage?: SessionUsage;
}

import type {
	SessionCategory,
	SessionInput,
	SessionResult,
	SessionResultSubtype,
	SessionTurn,
	SessionUsage,
} from './session/session_types';

export type {
	SessionCategory,
	SessionInput,
	SessionResult,
	SessionResultSubtype,
	SessionTurn,
	SessionUsage,
};

export type RuntimeModelEvent = LlmEvent;

export type RuntimeOutput = SessionResult;

type RuntimeInputBase = Pick<
	SessionInput,
	| 'sessionId'
	| 'messages'
	| 'model'
	| 'effort'
	| 'maxTurns'
	| 'maxIterations'
	| 'files'
	| 'promptCapabilities'
	| 'deferPersist'
> & {
	legacySessionId?: string;
	runId: string;
	task: string;
	message: string;
	providerId?: string;
	agentId: string;
	contextMode: 'minimal' | 'workspace';
	interactionMode: import('../../shared/agent_types').AgentInteractionMode;
	toolProfile?: AgentToolProfileId;
	toolsDeny?: string[];
	approvalWindowId?: number;
	explicitSkill?: string;
	scope?: import('./execution/scope').ExecutionScope;
};

export type RuntimeInput = RuntimeInputBase &
	({ type: 'default'; toolsAllow?: string[] } | { type: 'background'; toolsAllow?: string[] });

export interface RuntimeModelRoute {
	task: string;
	model: string;
}

export interface RuntimePrompt {
	system: string;
	prompt: string;
	messages: Message[];
}

export interface RuntimePerception {
	prompt: RuntimePrompt;
	model: string;
	maxTokens: number;
	maxRetries: number;
	maxIterations: number;
	tools: Tool[];
	signal?: AbortSignal;
}

export interface McpDiscoveryIssue {
	serverId: string;
	phase: 'connect' | 'list' | 'schema' | 'limit';
	toolName?: string;
}

export interface McpDiscoveryDiagnostics {
	configuredServers: number;
	enabledServers: number;
	connectedServers: number;
	listedTools: number;
	loadedTools: number;
	rejectedTools: number;
	truncated: boolean;
	failures: McpDiscoveryIssue[];
}

export type RuntimeEvent =
	| RuntimeModelEvent
	| { type: 'provider_queue_metrics'; providerId: string; queueDelayMs: number; attempt: number }
	| { type: 'run_error'; message: string }
	| {
			type: 'run_started';
			sessionId: string;
			interactionMode: import('../../shared/agent_types').AgentInteractionMode;
			model: string;
			providerId: string;
			tools: string[];
			mcpDiscovery?: McpDiscoveryDiagnostics;
			skillDiagnostics?: readonly SkillDiagnostic[];
			skillActivations?: { id: string; name: string; hash: string; trust: SkillTrust }[];
	  }
	| {
			type: 'user_input_request';
			requestId: string;
			toolCallId: string;
			questions: import('../../shared/agent_types').AgentUserInputQuestion[];
			expiresAt: string;
			inputFingerprint: string;
	  }
	| {
			type: 'user_input_result';
			requestId: string;
			toolCallId: string;
			status: 'resolved' | 'interrupted';
			answers: import('../../shared/agent_types').AgentUserInputAnswer[];
	  }
	| { type: 'assistant_message'; content: string; toolCalls: ToolCall[] }
	| {
			type: 'tool_call_start';
			toolCallId: string;
			toolName: string;
			input: Record<string, unknown>;
	  }
	| {
			type: 'tool_permission_request';
			approvalId: string;
			toolCallId: string;
			toolName: string;
			input: Record<string, unknown>;
			mode: 'ask';
			targets: string[];
			reason:
				| 'outside_trusted_location'
				| 'host_execution'
				| 'destructive_operation'
				| 'sensitive_operation';
			persistable: boolean;
			allowOnce: boolean;
			expiresAt: string;
			inputFingerprint: string;
	  }
	| {
			type: 'tool_call_end';
			toolCallId: string;
			toolName: string;
			input: Record<string, unknown>;
			output: unknown;
			isError?: boolean;
			durationMs: number;
			permissionOutcome?: 'allow' | 'deny' | 'approve' | 'approve_always' | 'reject';
	  }
	| { type: 'run_finished'; result: RuntimeOutput };
