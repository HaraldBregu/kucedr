import type { ModelMetadata } from './model_types';

export function modelContextWindow(metadata: ModelMetadata | undefined): number | undefined {
	const contract =
		metadata?.inputs.context_window ??
		metadata?.inputs.context_length ??
		metadata?.inputs.max_context_tokens;
	const input =
		metadata?.inputs.max_input_tokens ??
		metadata?.inputs.input_token_limit ??
		metadata?.inputs.maximum_input_tokens;
	const limit =
		metadata?.contextWindow ??
		contract?.maximum ??
		contract?.default ??
		metadata?.maxInputTokens ??
		input?.maximum ??
		input?.default;
	return typeof limit === 'number' && Number.isFinite(limit) && limit > 0
		? Math.floor(limit)
		: undefined;
}
