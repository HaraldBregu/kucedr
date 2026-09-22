import type { Model } from '@/lib/compat';
import type { PublicProvider } from '../../../../../shared';
import type { ProviderModelGroup } from '../../start/setupTypes';

export interface ModelConfigurationState {
	readonly providers: PublicProvider[];
	readonly modelGroups: ProviderModelGroup[];
	readonly providerId: string;
	readonly modelId: string;
	readonly loading: boolean;
	readonly loadingModels: boolean;
	readonly saving: boolean;
	readonly saved: boolean;
	readonly error: string | null;
}

export const initialModelConfigurationState: ModelConfigurationState = {
	providers: [],
	modelGroups: [],
	providerId: '',
	modelId: '',
	loading: true,
	loadingModels: false,
	saving: false,
	saved: false,
	error: null,
};

export function firstErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message.trim()) return error.message;
	return fallback;
}

export function mergeModels(models: readonly Model[], selectedModel?: Model): Model[] {
	const byId = new Map(models.map((model) => [model.id, model]));
	if (selectedModel && !byId.has(selectedModel.id)) byId.set(selectedModel.id, selectedModel);
	return [...byId.values()];
}

export function mergeProviders(
	providers: readonly PublicProvider[],
	selectedProvider?: PublicProvider
): PublicProvider[] {
	const byId = new Map(providers.map((provider) => [provider.id, provider]));
	if (selectedProvider && !byId.has(selectedProvider.id)) byId.set(selectedProvider.id, selectedProvider);
	return [...byId.values()];
}
