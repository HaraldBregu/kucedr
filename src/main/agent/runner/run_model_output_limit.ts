import { findModel } from '../../models';

export const DEFAULT_MODEL_OUTPUT_TOKENS = 8_192;
export const LIVE_MODEL_OUTPUT_TOKENS = 32_768;

export function modelOutputLimit(
	providerId: string,
	modelId: string,
	options: Record<string, unknown>,
	liveMaximum?: number
): number {
	const metadata = findModel(providerId, 'llm', modelId)?.metadata;
	const inputs = metadata?.inputs;
	const preferred = metadata?.outputTokensField;
	const configured = [
		...(preferred ? [options[preferred]] : []),
		options.max_output_tokens,
		options.max_completion_tokens,
		options.max_tokens,
		options.maxTokens,
	].find((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
	const contract = (preferred ? inputs?.[preferred] : undefined) ??
		inputs?.max_output_tokens ?? inputs?.max_completion_tokens ?? inputs?.max_tokens;
	const live = metadata ? undefined : liveMaximum;
	const maximum = contract?.maximum ?? live;
	const catalogDefault = metadata?.defaultOutputTokens ?? contract?.default;
	const fallback =
		typeof maximum === 'number'
			? Math.min(maximum, live ? LIVE_MODEL_OUTPUT_TOKENS : DEFAULT_MODEL_OUTPUT_TOKENS)
			: DEFAULT_MODEL_OUTPUT_TOKENS;
	const selected = configured ?? (typeof catalogDefault === 'number' ? catalogDefault : fallback);
	const bounded = typeof maximum === 'number' ? Math.min(selected, maximum) : selected;
	const cap = preferred === 'max_completion_tokens' && typeof maximum === 'number' ? maximum : 65_536;
	return Math.max(1, Math.floor(Math.min(bounded, cap)));
}
