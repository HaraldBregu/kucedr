import React, { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { ModelOptions } from '@/components/model-options';
import { modelsFor, providerIdsFor, providerModels, providers } from '@/lib/providers';
import { updateModelOptions } from '@/lib/options';
import type { ModelCapability } from '@shared/model_types';
import type { PublicProvider } from '@shared/provider_types';
import { ModelProviderConfiguration } from '../../components/model-configuration';
import {
	firstErrorMessage,
	initialModelConfigurationState,
	type ModelConfigurationState,
} from '../../components/model-configuration-state';
import type { ProviderModelGroup } from '../../../start/setupTypes';

interface MediaModelApi {
	readonly getProviderId: () => Promise<string | undefined>;
	readonly setProviderId: (providerId: string) => Promise<void>;
	readonly getModelId: () => Promise<string | undefined>;
	readonly setModelId: (modelId: string) => Promise<void>;
	readonly getOptions?: () => Promise<Record<string, unknown>>;
	readonly setOptions?: (options: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

interface AgentMediaModelConfigurationProps {
	readonly api: MediaModelApi;
	readonly capability: Extract<
		ModelCapability,
		'speech-to-text' | 'text-to-image' | 'text-to-audio' | 'text-to-video' | 'text-to-speech'
	>;
	readonly idPrefix: string;
	readonly title: ReactNode;
	readonly description: ReactNode;
	readonly collapsible?: boolean;
	readonly showIcon?: boolean;
	readonly grouped?: boolean;
	readonly showSelectedModel?: boolean;
	readonly showFieldLabel?: boolean;
	readonly showContentSeparator?: boolean;
	readonly inlineAdvanced?: boolean;
	readonly showOptions?: boolean;
	readonly icon?: LucideIcon;
}

const MEDIA_CONTENT_INPUTS = new Set([
	'callback_url',
	'character_reference_images',
	'character_reference_text_description',
	'firstFrame',
	'first_frame',
	'first_frame_image',
	'image',
	'inputImage',
	'input_image',
	'lastFrame',
	'last_frame',
	'last_frame_image',
	'lyrics',
	'model_id',
	'prompt',
	'promptImage',
	'promptText',
	'prompt_image',
	'referenceImages',
	'reference_audio',
	'reference_images',
	'session',
	'style_reference_images',
	'text',
	'transcript',
	'video',
]);

export function AgentMediaModelConfiguration({
	api,
	capability,
	idPrefix,
	title,
	description,
	collapsible = true,
	showIcon = true,
	grouped = false,
	showSelectedModel = false,
	showFieldLabel = true,
	showContentSeparator = true,
	inlineAdvanced = false,
	showOptions = true,
	icon,
}: AgentMediaModelConfigurationProps): React.JSX.Element {
	const { t } = useTranslation();
	const [state, setState] = useState<ModelConfigurationState>(initialModelConfigurationState);
	const [options, setOptions] = useState<Record<string, unknown>>({});
	const selectedModel = modelsFor(capability).find(
		(model) => model.provider.id === state.providerId && model.id === state.modelId
	);
	const inputs =
		selectedModel?.metadata?.documentationStatus === 'verified'
			? selectedModel.metadata.inputs
			: {};

	useEffect(() => {
		let mounted = true;
		void Promise.all([
			api.getProviderId(),
			api.getModelId(),
			api.getOptions?.() ?? Promise.resolve({}),
		])
			.then(([storedProviderId, storedModelId, storedOptions]) => {
				if (!mounted) return;
				const availableProviders = providerIdsFor(capability).flatMap((providerId) => {
					const provider = providers().find((entry) => entry.id === providerId);
					return provider && providerModels(providerId, capability).length > 0 ? [provider] : [];
				});
				const modelGroups: ProviderModelGroup[] = availableProviders.map((provider) => ({
					provider: provider as PublicProvider,
					models: providerModels(provider.id, capability),
				}));
				const preferredGroup =
					modelGroups.find((group) => group.provider.id === storedProviderId) ?? modelGroups[0];
				const preferredModel =
					preferredGroup?.models.find((model) => model.id === storedModelId) ??
					preferredGroup?.models[0];
				setState({
					providers: availableProviders,
					modelGroups,
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
			})
			.catch((error) => {
				if (!mounted) return;
				setState({
					...initialModelConfigurationState,
					loading: false,
					loadingModels: false,
					error: firstErrorMessage(error, t('settings.modelServices.loadError')),
				});
			});
		return () => {
			mounted = false;
		};
	}, [api, capability, t]);

	const handleChange = async (providerId: string, modelId: string): Promise<void> => {
		const group = state.modelGroups.find((entry) => entry.provider.id === providerId);
		if (!group?.models.some((model) => model.id === modelId)) return;
		setOptions({});
		setState((current) => ({
			...current,
			providerId,
			modelId,
			saving: true,
			saved: false,
			error: null,
		}));
		try {
			await api.setProviderId(providerId);
			await api.setModelId(modelId);
			if (api.setOptions) await api.setOptions({});
			setState((current) => ({ ...current, saving: false, saved: true }));
		} catch (error) {
			setState((current) => ({
				...current,
				saving: false,
				error: firstErrorMessage(error, t('settings.modelServices.saveError')),
			}));
		}
	};

	const handleOptionChange = (path: readonly string[], value: unknown): void => {
		if (!api.setOptions) return;
		const next = updateModelOptions(options, path, value);
		setOptions(next);
		void api.setOptions(next).catch((error) => {
			setState((current) => ({
				...current,
				error: firstErrorMessage(error, t('settings.modelServices.saveError')),
			}));
		});
	};

	return (
		<ModelProviderConfiguration
			configState={state}
			idPrefix={idPrefix}
			collapsible={collapsible}
			showIcon={showIcon || Boolean(icon)}
			icon={icon}
			grouped={grouped}
			showSelectedModel={showSelectedModel}
			showFieldLabel={showFieldLabel}
			showContentSeparator={showContentSeparator}
			triggerTitle={title}
			description={description}
			showInlineError
			onChange={(providerId, modelId) => void handleChange(providerId, modelId)}
		>
			{showOptions && (
				<ModelOptions
					key={`${state.providerId}:${state.modelId}`}
					inputs={inputs}
					values={options}
					excludedInputs={MEDIA_CONTENT_INPUTS}
					allowComplex={capability === 'text-to-speech'}
					inlineAdvanced={inlineAdvanced}
					onChange={handleOptionChange}
				/>
			)}
		</ModelProviderConfiguration>
	);
}
