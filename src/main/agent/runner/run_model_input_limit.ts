import { findModel } from '../../models';

export const DEFAULT_MODEL_CONTEXT_TOKENS = 128_000;
export const MODEL_CONTEXT_SAFETY_TOKENS = 1_024;

export function modelInputLimit(
	providerId: string,
	modelId: string,
	maxOutputTokens: number,
	contextWindow?: number
): number {
	const metadata = findModel(providerId, 'llm', modelId)?.metadata;
	const inputs = metadata?.inputs;
	const inputContract =
		inputs?.max_input_tokens ?? inputs?.input_token_limit ?? inputs?.maximum_input_tokens;
	const contextContract =
		inputs?.context_window ?? inputs?.context_length ?? inputs?.max_context_tokens;
	const configuredInput = metadata?.maxInputTokens ?? inputContract?.maximum ?? inputContract?.default;
	const configuredContext =
		contextWindow ??
		metadata?.contextWindow ??
		contextContract?.maximum ??
		contextContract?.default;
	// 128K is the conservative fallback when the local catalog has no verified context metadata.
	const available =
		typeof configuredInput === 'number'
			? configuredInput - MODEL_CONTEXT_SAFETY_TOKENS
			: (typeof configuredContext === 'number' ? configuredContext : DEFAULT_MODEL_CONTEXT_TOKENS) -
				maxOutputTokens -
				MODEL_CONTEXT_SAFETY_TOKENS;
	return Math.max(256, Math.min(1_000_000, Math.floor(available)));
}
