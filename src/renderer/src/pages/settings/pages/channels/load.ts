import {
	providerIdsFor,
	providerModels,
	providers,
	supportsSpeechToTextApiType,
} from '@/lib/providers';
import type { ChannelModelKind } from '@shared/channels_types';
import type { ProviderModelGroup } from '../../../start/setupTypes';
import {
	firstErrorMessage,
	initialModelConfigurationState,
	mergeProviders,
	type ModelConfigurationState,
} from '../../components/model-configuration-state';

export async function loadChannelModelState(
	kind: ChannelModelKind,
	t: (key: string) => string
): Promise<ModelConfigurationState> {
	try {
		const selection = await window.app.getChannelsModelSelection(kind);
		const providerId = selection.providerId?.trim();
		const modelId = selection.modelId?.trim();
		const storedProvider = providers().find((provider) => provider.id === providerId);
		const capability = kind === 'llm' ? 'llm' : 'text-to-speech';
		const availableProviders = mergeProviders(
			kind === 'stt'
				? await window.models.transcribe.listProviders()
				: providerIdsFor(capability).flatMap((id) =>
						providers().filter((provider) => provider.id === id)
					),
			storedProvider
		);
		const modelGroups: ProviderModelGroup[] = [];
		let firstModelError: unknown;
		for (const provider of availableProviders) {
			try {
				const models =
					kind === 'stt'
						? (await window.models.transcribe.listModels(provider.id)).filter((model) =>
								supportsSpeechToTextApiType(provider.id, model.id, 'batch')
							)
						: providerModels(provider.id, capability);
				if (models.length > 0) modelGroups.push({ provider, models });
			} catch (error) {
				firstModelError ??= error;
			}
		}
		const group = modelGroups.find((item) => item.provider.id === providerId) ?? modelGroups[0];
		const model = group?.models.find((item) => item.id === modelId) ?? group?.models[0];
		return {
			...initialModelConfigurationState,
			providers: availableProviders,
			modelGroups,
			providerId: group?.provider.id ?? '',
			modelId: model?.id ?? '',
			loading: false,
			loadingModels: false,
			error: firstModelError
				? firstErrorMessage(firstModelError, t('settings.modelServices.modelsLoadError'))
				: null,
		};
	} catch (error) {
		return {
			...initialModelConfigurationState,
			loading: false,
			loadingModels: false,
			error: firstErrorMessage(error, t('settings.modelServices.loadError')),
		};
	}
}
