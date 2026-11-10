import type { ModelReasoningEffort } from '../../shared/agent_types';
import type { SessionCategory } from './session/session_types';
import type { Tool } from './types';

export type RunStop =
	| { readonly kind: 'accept' }
	| { readonly kind: 'retry'; readonly instruction: string }
	| { readonly kind: 'continue'; readonly message: string };

/** Optional behaviour added to one run. A run without an extension is unrestricted. */
export interface RunExtension {
	readonly ids: readonly string[];
	readonly restricted: boolean;
	readonly ask: boolean;
	readonly readOnlyShell: boolean;
	readonly denyAsks: boolean;
	readonly prompt: string;
	readonly protectedPrompt: string;
	readonly model?: string;
	readonly effort?: ModelReasoningEffort;
	readonly tools: readonly Tool[];
	allows(tool: Tool): boolean;
	gate(tool: Tool, input: Record<string, unknown>, workspace: string): string | undefined;
	context(): string;
	stop(content: string, may: { readonly retry: boolean; readonly continue: boolean }): RunStop;
	child(): RunExtension;
}

export interface RunExtensionRequest {
	readonly category: SessionCategory;
	readonly modeIds: readonly string[];
	readonly sessionDirectory: string;
	readonly providerId?: string;
	readonly modelId?: string;
}

export type RunExtender = (request: RunExtensionRequest) => RunExtension | undefined;
