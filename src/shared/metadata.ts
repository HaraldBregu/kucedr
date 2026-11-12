import type { ModelMetadata, ProviderModel } from './model_types';
import type { PublicProvider } from './provider_types';

export function resolveModelMetadata(
	model: ProviderModel | undefined,
	provider: PublicProvider | undefined,
	modelId: string
): ModelMetadata | undefined {
	if (model?.metadata && !model.discovered) return model.metadata;
	const discovery = provider?.discoveryMetadata;
	const family = discovery?.families?.find((item) =>
		modelId.toLowerCase().includes(item.match.toLowerCase())
	);
	return discovery && family ? { ...discovery, ...family.metadata } : discovery;
}
