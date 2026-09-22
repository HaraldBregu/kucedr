import type { Message, Tool, ToolCall } from '../../../agent/types';
import type { ResolvedProvider } from '../../../../shared/provider_types';
import type { ModelReasoningEffort } from '../../../../shared/agent_types';

export interface LlmRequest {
	messages: Message[];
	systemPrompt?: string;
	provider: ResolvedProvider;
	model: string;
	effort?: ModelReasoningEffort;
	options?: Record<string, unknown>;
	maxTokens: number;
	tools?: Tool[];
	signal?: AbortSignal;
	streaming?: boolean;
}

export interface LlmResponse {
	content: string;
	toolCalls?: ToolCall[];
	model?: string;
	stopReason?: string;
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
	};
}

export type LlmEvent =
	| { type: 'model_call_start'; model: string; effort?: ModelReasoningEffort }
	| { type: 'model_call_delta'; delta: string }
	| { type: 'model_provider_item'; provider: 'openai'; item: unknown }
	| { type: 'model_tool_call_start'; id: string; name: string }
	| { type: 'model_tool_call_args_delta'; id: string; jsonDelta: string }
	| { type: 'model_tool_call_end'; id: string }
	| {
			type: 'model_call_end';
			model: string;
			stopReason?: string;
			usage?: LlmResponse['usage'];
			durationMs?: number;
			firstTokenLatencyMs?: number;
			retryCount?: number;
	  };

export interface LlmProviderSpec {
	id: string;
	apiKey: string;
	baseURL?: string;
}

export interface LlmUsage {
	inputTokens: number;
	outputTokens: number;
}

export type LlmProviderEvent =
	| { type: 'message_start' }
	| { type: 'response_created'; id: string }
	| { type: 'reasoning_item'; provider?: 'openai' | 'deepseek'; item: unknown }
	| { type: 'text_delta'; text: string }
	| { type: 'tool_call_start'; id: string; name: string }
	| { type: 'tool_call_args_delta'; id: string; jsonDelta: string }
	| { type: 'tool_call_end'; id: string }
	| {
			type: 'mcp_approval_request';
			id: string;
			serverLabel: string;
			name: string;
			arguments: string;
			item?: unknown;
	  }
	| {
			type: 'mcp_list_tools';
			serverLabel: string;
			item?: unknown;
			tools: Array<{
				name: string;
				description?: string;
				inputSchema?: Record<string, unknown>;
			}>;
	  }
	| {
			type: 'mcp_call';
			id: string;
			serverLabel: string;
			name: string;
			arguments: string;
			output?: string;
			error?: unknown;
			status?: string;
			item?: unknown;
	  }
	| { type: 'message_end'; stopReason: string; usage: LlmUsage };

export type LlmContentBlock =
	| { type: 'text'; text: string }
	| { type: 'reasoning'; provider: 'openai' | 'deepseek'; item: unknown }
	| { type: 'provider_item'; provider: 'openai'; item: unknown }
	| {
			type: 'tool_use';
			toolUseId: string;
			toolName: string;
			toolArgs: unknown;
	  };

export type LlmToolResultBlock =
	| { type: 'text'; text: string }
	| { type: 'image'; mimeType?: string; base64?: string };

export type LlmUserContentBlock =
	| { type: 'text'; text: string }
	| { type: 'image'; mimeType: string; base64: string }
	| { type: 'document'; name: string; mimeType: 'application/pdf'; base64: string };

export type LlmToolResultStatus = 'ok' | 'error' | 'blocked' | 'rejected';

export type LlmTranscriptEntry =
	| { role: 'user'; content: string | LlmUserContentBlock[] }
	| { role: 'assistant'; content: LlmContentBlock[] }
	| {
			role: 'tool';
			toolUseId: string;
			content: LlmToolResultBlock[];
			isError?: boolean;
			status?: LlmToolResultStatus;
	  };

export interface LlmJsonSchema {
	type?: string;
	properties?: Record<string, unknown>;
	required?: string[];
	items?: unknown;
	description?: string;
	enum?: unknown[];
	additionalProperties?: boolean | unknown;
	[k: string]: unknown;
}

export interface LlmToolSpec {
	name: string;
	description: string;
	schema: LlmJsonSchema;
	inputExamples?: readonly Record<string, unknown>[];
}

export interface LlmStreamRequest {
	model: string;
	effort?: ModelReasoningEffort;
	options?: Record<string, unknown>;
	system: string;
	messages: LlmTranscriptEntry[];
	inputItems?: unknown[];
	previousResponseId?: string;
	tools: LlmToolSpec[];
	maxTokens: number;
	signal?: AbortSignal;
	streaming?: boolean;
}

export interface LlmAdapter {
	stream(req: LlmStreamRequest): AsyncIterable<LlmProviderEvent>;
}

export class LlmContextOverflowError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'LlmContextOverflowError';
	}
}

export class LlmProviderAuthError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'LlmProviderAuthError';
	}
}
