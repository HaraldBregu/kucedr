import type { ModelReasoningEffort } from './agent_types';

export interface TextRequest {
	prompt: string;
	providerId?: string;
	modelId?: string;
	maxTokens?: number;
	effort?: ModelReasoningEffort;
}
