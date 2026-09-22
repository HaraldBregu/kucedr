import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ModelOptions } from '@/components/model-options';
import { defaultProviderId, modelsFor, providerModels, providers } from '@/lib/providers';
import { updateModelOptions } from '@/lib/options';
import { ModelProviderConfiguration } from '../../components/model-configuration';
import {
	firstErrorMessage,
	initialModelConfigurationState,
	type ModelConfigurationState,
} from '../../components/model-configuration-state';
import type { ProviderModelGroup } from '../../../start/setupTypes';

const RUNTIME_PROVIDER_ID = 'openai';
const DEFAULT_VOICE = 'marin';

function realtimeGroups(): ProviderModelGroup[] {
	const provider = providers().find((item) => item.id === RUNTIME_PROVIDER_ID);
	const models = providerModels(RUNTIME_PROVIDER_ID, 'realtime-voice');
	return provider && models.length > 0 ? [{ provider, models }] : [];
}

function defaultRealtimeModelId(): string | undefined {
	return (
		modelsFor('realtime-voice').find(
			(model) => model.provider.id === RUNTIME_PROVIDER_ID && model.default
		)?.id ?? providerModels(RUNTIME_PROVIDER_ID, 'realtime-voice')[0]?.id
	);
}

export default function RealtimeVoiceConfiguration(): React.JSX.Element {
	const { t } = useTranslation();
	const [state, setState] = useState<ModelConfigurationState>(initialModelConfigurationState);
	const [options, setOptions] = useState<Record<string, unknown>>({});
	const group = state.modelGroups.find((item) => item.provider.id === state.providerId);
	const model = group?.models.find((item) => item.id === state.modelId);
	const voiceInput = model?.metadata?.inputs.voice;
	const defaultVoice =
		typeof voiceInput?.default === 'string' ? voiceInput.default : DEFAULT_VOICE;
	const selectedVoice =
		typeof options.voice === 'string' && options.voice.trim() ? options.voice : defaultVoice;

	useEffect(() => {
		let mounted = true;
		void (async () => {
			setState((current) => ({
				...current,
				loading: true,
				loadingModels: true,
				error: null,
			}));
			try {
				const [storedProviderId, storedModelId, storedOptions] = await Promise.all([
					window.models.realtimeVoice.getProviderId(),
					window.models.realtimeVoice.getModelId(),
					window.models.realtimeVoice.getOptions(),
				]);
				const groups = realtimeGroups();
				const preferredGroup =
					groups.find((item) => item.provider.id === storedProviderId) ??
					groups.find((item) => item.provider.id === defaultProviderId('realtime-voice')) ??
					groups[0];
				const preferredModel =
					preferredGroup?.models.find((item) => item.id === storedModelId) ??
					preferredGroup?.models.find((item) => item.id === defaultRealtimeModelId()) ??
					preferredGroup?.models[0];
				if (!mounted) return;
				setState({
					providers: groups.map((item) => item.provider),
					modelGroups: groups,
					providerId: preferredGroup?.provider.id ?? '',
					modelId: preferredModel?.id ?? '',
					loading: false,
					loadingModels: false,
					saving: false,
					saved: false,
					error: null,
				});
				setOptions(
					preferredGroup?.provider.id === storedProviderId && preferredModel?.id === storedModelId
						? storedOptions
						: {}
				);
			} catch (error) {
				if (!mounted) return;
				setState({
					...initialModelConfigurationState,
					loading: false,
					loadingModels: false,
					error: firstErrorMessage(error, t('settings.modelServices.loadError')),
				});
			}
		})();
		return () => {
			mounted = false;
		};
	}, [t]);

	const save = async (
		nextProviderId: string,
		nextModelId: string,
		nextOptions: Record<string, unknown>
	): Promise<void> => {
		setState((current) => ({
			...current,
			providerId: nextProviderId,
			modelId: nextModelId,
			saving: true,
			saved: false,
			error: null,
		}));
		setOptions(nextOptions);
		try {
			await window.models.realtimeVoice.setProviderId(nextProviderId);
			await window.models.realtimeVoice.setModelId(nextModelId);
			await window.models.realtimeVoice.setOptions(nextOptions);
			setState((current) => ({ ...current, saving: false, saved: true }));
		} catch (error) {
			setState((current) => ({
				...current,
				saving: false,
				error: firstErrorMessage(error, t('settings.modelServices.saveError')),
			}));
		}
	};

	const handleModelChange = (providerId: string, modelId: string): void => {
		const nextModel = providerModels(providerId, 'realtime-voice').find(
			(item) => item.id === modelId
		);
		const schema = nextModel?.metadata?.inputs.voice;
		const choices = schema?.enum?.filter((choice): choice is string => typeof choice === 'string');
		const nextDefault = typeof schema?.default === 'string' ? schema.default : DEFAULT_VOICE;
		const nextVoice = choices?.includes(selectedVoice) ? selectedVoice : nextDefault;
		void save(providerId, modelId, { voice: nextVoice });
	};

	const handleVoiceChange = (path: readonly string[], value: unknown): void => {
		const normalizedVoice = typeof value === 'string' && value.trim() ? value : defaultVoice;
		void save(state.providerId, state.modelId, updateModelOptions(options, path, normalizedVoice));
	};

	return (
		<ModelProviderConfiguration
			configState={state}
			idPrefix="realtime-voice"
			triggerTitle={t('settings.modelServices.realtimeVoiceConfiguration')}
			triggerDescription={
				model
					? `${group?.provider.name ?? group?.provider.id} - ${model.name || model.id}`
					: t('settings.modelServices.realtimeVoiceDescription')
			}
			description={t('settings.modelServices.realtimeVoiceModelDescription')}
			showInlineError
			defaultOpen
			onChange={handleModelChange}
		>
			<ModelOptions
				key={`${state.providerId}:${state.modelId}`}
				inputs={voiceInput ? { voice: voiceInput } : {}}
				values={{ voice: selectedVoice }}
				onChange={handleVoiceChange}
			/>
		</ModelProviderConfiguration>
	);
}
