import type { CatalogModel } from '../../../shared/model_types';
import { findModel } from '../../models';
import { getProvider } from '../../settings_store';

export function embeddingEndpoint(
	providerId: string,
	modelId: string
): { model: CatalogModel; url: string; apiKey: string } {
	const model = findModel(providerId, 'embedding', modelId);
	if (!model) throw new Error(`Embedding model is not available: ${modelId}`);
	const stored = getProvider(providerId);
	const apiKey = stored?.apiKey.trim() ?? '';
	const url = `${(model.url ?? '').replace(/\/$/, '')}${model.metadata?.endpoint ?? ''}`;
	const rule = model.metadata?.baseUrlRule;
	if (!rule) return { model, url, apiKey };
	let base: URL | undefined;
	try {
		base = new URL(stored?.baseUrl ?? '');
	} catch {
		base = undefined;
	}
	if (!base || !new RegExp(rule.pattern, 'i').test(`${base.protocol}//${base.hostname}`)) {
		throw new Error(
			`Set the ${model.provider.name} provider base URL${rule.example ? ` to ${rule.example}` : ''} for embeddings.`
		);
	}
	return { model, url: `${base.origin}${url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '')}`, apiKey };
}
