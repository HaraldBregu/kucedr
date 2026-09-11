export const CODING_PROVIDER_IDS = ['openai-codex', 'openai', 'anthropic'] as const;
export const CODING_THINKING_LEVELS = [
	'off',
	'minimal',
	'low',
	'medium',
	'high',
	'xhigh',
	'max',
] as const;
export const CODING_TOOL_MODES = ['read-only', 'coding'] as const;

export type CodingProviderId = (typeof CODING_PROVIDER_IDS)[number];
export type CodingThinkingLevel = (typeof CODING_THINKING_LEVELS)[number];
export type CodingToolMode = (typeof CODING_TOOL_MODES)[number];
export type CodingRunMode = 'agent' | 'shell';

export interface CodingSettings {
	readonly runtime: 'pi';
	readonly providerId: CodingProviderId;
	readonly modelId: string;
	readonly thinkingLevel: CodingThinkingLevel;
	readonly toolMode: CodingToolMode;
}

export interface CodingModel {
	readonly id: string;
	readonly name: string;
	readonly reasoning: boolean;
	readonly contextWindow: number;
}

export interface CodingProvider {
	readonly id: CodingProviderId;
	readonly name: string;
	readonly authentication: 'oauth' | 'api-key';
	readonly configured: boolean;
	readonly authType?: 'oauth' | 'api_key';
	readonly authSource?: string;
	readonly models: readonly CodingModel[];
}

export interface CodingCatalog {
	readonly providers: readonly CodingProvider[];
}

export interface CodingProject {
	readonly id: string;
	readonly name: string;
	readonly directory: string;
	readonly kind: 'agent-workspace' | 'external';
	readonly createdAt: string;
	readonly lastOpenedAt: string;
	readonly available: boolean;
}

export type CodingProjectInstructionScope = 'workspace' | 'ancestor' | 'coding-global';

export interface CodingProjectInstructionSource {
	readonly path: string;
	readonly scope: CodingProjectInstructionScope;
}

export interface CodingProjectInstructions {
	readonly projectId: string;
	readonly activeFilePath: string;
	readonly activeFileName: string;
	readonly content: string;
	readonly exists: boolean;
	readonly editable: boolean;
	readonly revision: string;
	readonly loadedSources: readonly CodingProjectInstructionSource[];
}

export interface CodingProjectInstructionsUpdate {
	readonly content: string;
	readonly expectedRevision: string;
}

export interface CodingSessionSummary {
	readonly id: string;
	readonly projectId: string;
	readonly title: string;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly messageCount: number;
}

export type CodingSessionBlock =
	| {
			readonly id: string;
			readonly type: 'message';
			readonly role: 'user' | 'assistant';
			readonly content: string;
			readonly timestamp: string;
	  }
	| {
			readonly id: string;
			readonly type: 'command';
			readonly command: string;
			readonly output: string;
			readonly status: 'succeeded' | 'failed' | 'cancelled';
			readonly exitCode?: number;
			readonly truncated: boolean;
			readonly timestamp: string;
	  };

export interface CodingSessionSnapshot {
	readonly session: CodingSessionSummary;
	readonly blocks: readonly CodingSessionBlock[];
}

export interface CodingRunRequest {
	readonly projectId: string;
	readonly sessionId?: string;
	readonly mode: CodingRunMode;
	readonly input: string;
}

export interface CodingRunResult {
	readonly projectId: string;
	readonly sessionId: string;
	readonly output: string;
}

interface CodingResponseEventBase {
	readonly runId: string;
	readonly projectId: string;
	readonly sessionId: string;
}

export type CodingResponseEvent =
	| (CodingResponseEventBase & {
			readonly type: 'status';
			readonly status: 'started' | 'completed' | 'cancelled';
	  })
	| (CodingResponseEventBase & { readonly type: 'text-delta'; readonly delta: string })
	| (CodingResponseEventBase & { readonly type: 'thinking-delta'; readonly delta: string })
	| (CodingResponseEventBase & {
			readonly type: 'tool-start';
			readonly toolCallId: string;
			readonly toolName: string;
	  })
	| (CodingResponseEventBase & {
			readonly type: 'tool-end';
			readonly toolCallId: string;
			readonly toolName: string;
			readonly isError: boolean;
	  })
	| (CodingResponseEventBase & {
			readonly type: 'command-start';
			readonly command: string;
	  })
	| (CodingResponseEventBase & { readonly type: 'command-output'; readonly delta: string })
	| (CodingResponseEventBase & {
			readonly type: 'command-end';
			readonly exitCode?: number;
			readonly cancelled: boolean;
			readonly truncated: boolean;
	  })
	| (CodingResponseEventBase & { readonly type: 'error'; readonly message: string });

export type CodingAuthEvent =
	| { readonly type: 'progress'; readonly message: string }
	| { readonly type: 'info'; readonly message: string; readonly url?: string }
	| { readonly type: 'auth-url'; readonly url: string; readonly instructions?: string }
	| {
			readonly type: 'device-code';
			readonly userCode: string;
			readonly verificationUri: string;
			readonly expiresInSeconds?: number;
	  };

export interface CodingAuthStatus {
	readonly configured: boolean;
	readonly type?: 'oauth' | 'api_key';
	readonly source?: string;
}

export function isCodingSettings(value: unknown): value is CodingSettings {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const settings = value as Partial<CodingSettings>;
	return (
		settings.runtime === 'pi' &&
		typeof settings.providerId === 'string' &&
		CODING_PROVIDER_IDS.includes(settings.providerId as CodingProviderId) &&
		typeof settings.modelId === 'string' &&
		typeof settings.thinkingLevel === 'string' &&
		CODING_THINKING_LEVELS.includes(settings.thinkingLevel as CodingThinkingLevel) &&
		typeof settings.toolMode === 'string' &&
		CODING_TOOL_MODES.includes(settings.toolMode as CodingToolMode)
	);
}

export function isCodingRunRequest(value: unknown): value is CodingRunRequest {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const request = value as Partial<CodingRunRequest>;
	return (
		typeof request.projectId === 'string' &&
		request.projectId.trim().length > 0 &&
		(request.sessionId === undefined ||
			(typeof request.sessionId === 'string' && request.sessionId.trim().length > 0)) &&
		(request.mode === 'agent' || request.mode === 'shell') &&
		typeof request.input === 'string' &&
		request.input.trim().length > 0
	);
}

export function isCodingProjectInstructionsUpdate(
	value: unknown
): value is CodingProjectInstructionsUpdate {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const update = value as Partial<CodingProjectInstructionsUpdate>;
	return (
		typeof update.content === 'string' &&
		typeof update.expectedRevision === 'string' &&
		update.expectedRevision.length > 0
	);
}
