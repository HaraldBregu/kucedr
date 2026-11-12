import { findModel, loadProviders } from '../../../models';
import { normalizeProviderId } from '../../../../shared/provider_types';
import type { ModelMetadata } from '../../../../shared/model_types';

export function metadata(providerId: string, modelId: string): ModelMetadata | undefined {
	const model = findModel(providerId, 'llm', modelId)?.metadata;
	if (model) return model;
	const normalized = normalizeProviderId(providerId);
	const discovery = loadProviders().find((provider) => provider.id === normalized)?.discoveryMetadata;
	const family = discovery?.families?.find((item) =>
		modelId.toLowerCase().includes(item.match.toLowerCase())
	);
	return discovery && family ? { ...discovery, ...family.metadata } : discovery;
}
