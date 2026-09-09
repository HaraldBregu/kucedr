import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ModelOptions } from '@/components/model-options';
import { modelsFor, providerModels, providers } from '@/lib/providers';
import { updateModelOptions } from '@/lib/options';
import { ModelProviderConfiguration } from '../../components/model-configuration';
import {
	firstErrorMessage,
	initialModelConfigurationState,
	type ModelConfigurationState,
} from '../../components/model-configuration-state';
import type { ProviderModelGroup } from '../../../start/setupTypes';

interface RealtimeConversationConfigurationProps {
	readonly selectDefaultModel?: boolean;
	readonly showFieldLabel?: boolean;
	readonly showSelectedModel?: boolean;
	readonly showContentSeparator?: boolean;
}

export default function RealtimeConversationConfiguration({
	selectDefaultModel = true,
	showFieldLabel = true,
	showSelectedModel = false,
	showContentSeparator = true,
}: RealtimeConversationConfigurationProps): React.JSX.Element {
	const { t } = useTranslation();
	const [state, setState] = useState<ModelConfigurationState>(initialModelConfigurationState);
	const [options, setOptions] = useState<Record<string, unknown>>({});
	const group = state.modelGroups.find((entry) => entry.provider.id === state.providerId);
	const model = group?.models.find((entry) => entry.id === state.modelId);
	const voiceInput =
		model?.metadata?.documentationStatus === 'verified' ? model.metadata.inputs.voice : undefined;
	const voices = voiceInput?.enum?.filter(
		(value): value is string => typeof value === 'string' && value.trim().length > 0
	);
	const defaultVoice =
		typeof voiceInput?.default === 'string' && voices?.includes(voiceInput.default)
			? voiceInput.default
			: voices?.[0];
	const selectedVoice =
		typeof options.voice === 'string' && voices?.includes(options.voice)
			? options.voice
			: defaultVoice;

	useEffect(() => {
		let mounted = true;
		void window.models.realtimeVoice.getSetup().then(
			(setup) => {
				if (!mounted) return;
				const allowed = new Set(
					setup.supportedModels.map(({ providerId, modelId }) => `${providerId}\u001F${modelId}`)
				);
				const modelGroups = setup.supportedModels.reduce<ProviderModelGroup[]>((groups, ref) => {
					const provider = providers().find((entry) => entry.id === ref.providerId);
					const supportedModel = providerModels(ref.providerId, 'realtime-voice').find(
						(entry) => entry.id === ref.modelId
					);
					if (!provider || !supportedModel) return groups;
					const existing = groups.find((entry) => entry.provider.id === provider.id);
					if (existing) existing.models.push(supportedModel);
					else groups.push({ provider, models: [supportedModel] });
					return groups;
				}, []);
				const configuredGroup = modelGroups.find((entry) => entry.provider.id === setup.providerId);
				const configuredModel = configuredGroup?.models.find((entry) => entry.id === setup.modelId);
				const catalogDefault = modelsFor('realtime-voice').find(
					(entry) => entry.default && allowed.has(`${entry.provider.id}\u001F${entry.id}`)
				);
				const defaultGroup = modelGroups.find(
					(entry) => entry.provider.id === catalogDefault?.provider.id
				);
				const preferredGroup = configuredModel
					? configuredGroup
					: selectDefaultModel
						? (defaultGroup ?? modelGroups[0])
						: undefined;
				const preferredModel =
					configuredModel ??
					(selectDefaultModel
						? (preferredGroup?.models.find((entry) => entry.id === catalogDefault?.id) ??
							preferredGroup?.models[0])
						: undefined);
				setState({
					providers: modelGroups.map((entry) => entry.provider),
					modelGroups,
					providerId: preferredGroup?.provider.id ?? '',
					modelId: preferredModel?.id ?? '',
					loading: false,
					loadingModels: false,
					saving: false,
					saved: false,
					error: null,
				});
				setOptions(configuredModel ? setup.options : {});
			},
			(error) => {
				if (!mounted) return;
				setState({
					...initialModelConfigurationState,
					loading: false,
					loadingModels: false,
					error: firstErrorMessage(error, t('settings.modelServices.loadError')),
				});
			}
		);
		return () => {
			mounted = false;
		};
	}, [selectDefaultModel, t]);

	const save = async (
		providerId: string,
		modelId: string,
		nextOptions: Record<string, unknown>
	): Promise<void> => {
		setState((current) => ({
			...current,
			providerId,
			modelId,
			saving: true,
			saved: false,
			error: null,
		}));
		setOptions(nextOptions);
		try {
			const setup = await window.models.realtimeVoice.setSetup({
				providerId,
				modelId,
				options: nextOptions,
			});
			setOptions(setup.options);
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
		const nextModel = state.modelGroups
			.find((entry) => entry.provider.id === providerId)
			?.models.find((entry) => entry.id === modelId);
		if (!nextModel) return;
		const nextInput =
			nextModel.metadata?.documentationStatus === 'verified'
				? nextModel.metadata.inputs.voice
				: undefined;
		const nextVoices = nextInput?.enum?.filter(
			(value): value is string => typeof value === 'string' && value.trim().length > 0
		);
		const nextDefault =
			typeof nextInput?.default === 'string' && nextVoices?.includes(nextInput.default)
				? nextInput.default
				: nextVoices?.[0];
		const voice =
			selectedVoice && nextVoices?.includes(selectedVoice) ? selectedVoice : nextDefault;
		void save(providerId, modelId, voice ? { voice } : {});
	};

	const handleVoiceChange = (path: readonly string[], value: unknown): void => {
		if (!state.providerId || !state.modelId) return;
		void save(state.providerId, state.modelId, updateModelOptions(options, path, value));
	};

	return (
		<>
			<ModelProviderConfiguration
				configState={state}
				idPrefix="agent-realtime-conversation"
				triggerTitle={t('settings.modelServices.realtimeConversationConfiguration')}
				triggerDescription={model ? undefined : t('settings.modelServices.modelPlaceholder')}
				description={t('settings.modelServices.realtimeConversationDescription')}
				showInlineError
				showIcon={false}
				showFieldLabel={showFieldLabel}
				showSelectedModel={showSelectedModel}
				showContentSeparator={showContentSeparator}
				grouped
				onChange={handleModelChange}
			>
				<ModelOptions
					key={`${state.providerId}:${state.modelId}`}
					inputs={voiceInput ? { voice: voiceInput } : {}}
					values={selectedVoice ? { voice: selectedVoice } : {}}
					inlineAdvanced={showSelectedModel}
					onChange={handleVoiceChange}
				/>
			</ModelProviderConfiguration>
		</>
	);
}
