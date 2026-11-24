import type { ModelCache } from '../../../../shared/model_types';
import type { LlmUsage } from './llm_types';

export function tokens(usage: LlmUsage, source: unknown, cache: ModelCache | undefined, costUsdPath?: string): LlmUsage {
	const read = (paths: readonly string[] | undefined) =>
		paths
			?.map((path) =>
				path
					.split('.')
					.reduce<unknown>(
						(value, key) => (value as Record<string, unknown> | null | undefined)?.[key],
						source
					)
			)
			.find((value): value is number => typeof value === 'number');
	const costUsd = costUsdPath ? read([costUsdPath]) : undefined;
	const cachedTokens = read(cache?.readTokens);
	const cacheWriteTokens = read(cache?.writeTokens);
	return {
		...usage,
		...(costUsd !== undefined && Number.isFinite(costUsd) && costUsd >= 0 ? { costUsd } : {}),
		...(cachedTokens === undefined ? {} : { cachedTokens }),
		...(cacheWriteTokens === undefined ? {} : { cacheWriteTokens }),
	};
}
