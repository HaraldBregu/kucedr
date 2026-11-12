import { findModel, loadProviders } from '../../../models';
import { normalizeProviderId } from '../../../../shared/provider_types';
import type { LlmProviderSpec } from './llm_types';

export function url(provider: LlmProviderSpec, modelId: string): string | undefined {
	const model = findModel(provider.id, 'llm', modelId)?.url;
	const normalized = normalizeProviderId(provider.id);
	const base = loadProviders().find((entry) => entry.id === normalized)?.baseUrl;
	return model && (!provider.baseURL || provider.baseURL === base) ? model : provider.baseURL;
}
