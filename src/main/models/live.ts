import { loadProviders } from '../models';

export interface LiveModelLimits {
	contextWindow?: number;
	maxOutputTokens?: number;
}

const discovered = new Map<string, Promise<Map<string, LiveModelLimits>>>();

function positive(value: unknown): number | undefined {
	return typeof value === 'number' && value > 0 ? value : undefined;
}

export async function liveModelLimits(
	providerId: string,
	modelId: string
): Promise<LiveModelLimits | undefined> {
	const modelsUrl = loadProviders().find((entry) => entry.id === providerId)?.modelsUrl;
	if (!modelsUrl) return undefined;
	// ponytail: one live lookup per provider per app run; if it fails the catalog fallbacks stay until restart
	let models = discovered.get(providerId);
	if (!models) {
		models = fetch(modelsUrl, { signal: AbortSignal.timeout(10_000) })
			.then(
				(response) =>
					response.json() as Promise<{
						data?: Array<{
							id?: unknown;
							context_length?: unknown;
							context_window?: unknown;
							max_output_tokens?: unknown;
							top_provider?: { max_completion_tokens?: unknown };
						}>;
					}>
			)
			.then(
				(body) =>
					new Map(
						(Array.isArray(body.data) ? body.data : []).flatMap((model) =>
							typeof model?.id === 'string'
								? [
										[
											model.id,
											{
												contextWindow: positive(model.context_length ?? model.context_window),
												maxOutputTokens: positive(
													model.max_output_tokens ?? model.top_provider?.max_completion_tokens
												),
											},
										] as const,
									]
								: []
						)
					)
			)
			.catch(() => new Map<string, LiveModelLimits>());
		discovered.set(providerId, models);
	}
	return (await models).get(modelId);
}
