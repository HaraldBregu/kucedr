import { findModel, loadProviders } from '../../../models';
import { normalizeProviderId } from '../../../../shared/provider_types';
import { resolveModelMetadata } from '../../../../shared/metadata';
import type { ModelMetadata } from '../../../../shared/model_types';

export function metadata(providerId: string, modelId: string): ModelMetadata | undefined {
	const normalized = normalizeProviderId(providerId);
	return resolveModelMetadata(
		findModel(providerId, 'llm', modelId),
		loadProviders().find((provider) => provider.id === normalized),
		modelId
	);
}
