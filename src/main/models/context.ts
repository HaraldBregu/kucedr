import { findModel, loadProviders } from '../models';
import { modelContextWindow } from '../../shared/model_context';
import type { ResolvedProvider } from '../../shared/provider_types';

const discovered = new Map<string, Promise<Map<string, number>>>();

export async function resolveContextWindow(
	provider: ResolvedProvider | undefined,
	modelId: string
): Promise<number | undefined> {
	if (!provider) return undefined;
	const known = modelContextWindow(findModel(provider.id, 'llm', modelId)?.metadata);
	if (known) return known;
	const modelsUrl = loadProviders().find((entry) => entry.id === provider.id)?.modelsUrl;
	if (!modelsUrl) return undefined;
	// ponytail: one live lookup per provider per app run; if it fails the 128K fallback stays until restart
	let windows = discovered.get(provider.id);
	if (!windows) {
		windows = fetch(modelsUrl, { signal: AbortSignal.timeout(10_000) })
			.then(
				(response) =>
					response.json() as Promise<{
						data?: Array<{ id?: unknown; context_length?: unknown; context_window?: unknown }>;
					}>
			)
			.then(
				(body) =>
					new Map(
						(Array.isArray(body.data) ? body.data : []).flatMap((model) => {
							const size = model?.context_length ?? model?.context_window;
							return typeof model?.id === 'string' && typeof size === 'number' && size > 0
								? [[model.id, size] as const]
								: [];
						})
					)
			)
			.catch(() => new Map<string, number>());
		discovered.set(provider.id, windows);
	}
	return (await windows).get(modelId);
}
