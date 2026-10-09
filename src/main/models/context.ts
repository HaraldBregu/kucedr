import { findModel } from '../models';
import { modelContextWindow } from '../../shared/model_context';
import type { ResolvedProvider } from '../../shared/provider_types';

export async function resolveContextWindow(
	provider: ResolvedProvider | undefined,
	modelId: string,
	options: Record<string, unknown> = {}
): Promise<number | undefined> {
	if (!provider) return undefined;
	if (provider.id !== 'ollama' && provider.id !== 'custom') {
		return modelContextWindow(findModel(provider.id, 'llm', modelId)?.metadata);
	}
	const configured = options.num_ctx;
	if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0)
		return Math.floor(configured);
	if (!provider.baseURL) return undefined;
	try {
		const response = await fetch(new URL('ps', `${provider.baseURL.replace(/\/+$/, '')}/`), {
			signal: AbortSignal.timeout(2_000),
		});
		if (response.ok) {
			const body = (await response.json()) as {
				models?: { name?: string; model?: string; context_length?: number }[];
			};
			const loaded = body.models?.find((model) =>
				[model.name, model.model].some((id) => id === modelId || id === `${modelId}:latest`)
			);
			if (
				loaded?.context_length &&
				Number.isFinite(loaded.context_length) &&
				loaded.context_length > 0
			)
				return loaded.context_length;
		}
		const details = await fetch(new URL('show', `${provider.baseURL.replace(/\/+$/, '')}/`), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ model: modelId }),
			signal: AbortSignal.timeout(2_000),
		});
		if (!details.ok) return undefined;
		const body = (await details.json()) as { parameters?: string };
		const parameter = body.parameters?.match(/(?:^|\n)num_ctx\s+(\d+)/)?.[1];
		return parameter && Number(parameter) > 0 ? Number(parameter) : undefined;
	} catch {
		return undefined;
	}
}
