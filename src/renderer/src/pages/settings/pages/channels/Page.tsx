import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, RadioTower } from 'lucide-react';
import type { Model } from '@/lib/compat';
import { providerIdsFor, providerModels, providers, supportsSpeechToTextApiType } from '@/lib/providers';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
import { ProviderAvatar } from '@/components/provider-avatar';
import { cn } from '@/lib/utils';
import type { CatalogService, PublicProvider } from '@shared/provider_types';
import type { ChannelModelSelection, ChannelModelKind } from '@shared/channels_types';
import { ModelProviderConfiguration } from '../../components/model-configuration';
import {
	firstErrorMessage,
	initialModelConfigurationState,
	mergeModels,
	mergeProviders,
	type ModelConfigurationState,
} from '../../components/model-configuration-state';
import type { ProviderModelGroup } from '../../../start/setupTypes';
import {
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsSection,
} from '../../components';

import ProvidersPage from '../providers/Page';

type CatalogProvider = PublicProvider;

function providerModelGroups(
	capability: 'llm' | 'text-to-speech'
): ProviderModelGroup[] {
	return providerIdsFor(capability).flatMap((providerId) => {
		const provider = getCatalogProviderById(providerId);
		const models = providerModels(providerId, capability);
		return provider && models.length > 0 ? [{ provider, models }] : [];
	});
}

function getCatalogProviderById(providerId: string): CatalogProvider | undefined {
	return providers().find((provider) => provider.id === providerId);
}

async function loadLlmState(
	t: (key: string) => string
): Promise<ModelConfigurationState> {
	const kind: ChannelModelKind = 'llm';
	try {
		const selection: ChannelModelSelection = await window.app.getChannelsModelSelection(kind);
		const storedProviderId = selection.providerId?.trim();
		const storedModelId = selection.modelId?.trim();
		const storedProvider = storedProviderId ? getCatalogProviderById(storedProviderId) : undefined;
		const availableProviders = mergeProviders(providerModelGroups('llm').map((group) => group.provider), storedProvider);
		const modelGroups: ProviderModelGroup[] = [];
		let firstModelError: unknown;

		for (const provider of availableProviders) {
			try {
				const models = providerModels(provider.id, 'llm');
				const nextModels =
					storedProvider?.id === provider.id && storedModelId
						? mergeModels(models, models.find((model) => model.id === storedModelId))
						: models;
				if (nextModels.length > 0) modelGroups.push({ provider, models: nextModels });
			} catch (error) {
				firstModelError ??= error;
			}
		}

		const preferredGroup = modelGroups.find((group) => group.provider.id === storedProvider?.id) ?? modelGroups[0];
		const preferredModel =
			preferredGroup?.models.find((model) => model.id === storedModelId) ??
			preferredGroup?.models[0];

		return {
			providers: availableProviders,
			modelGroups,
			providerId: preferredGroup?.provider.id ?? '',
			modelId: preferredModel?.id ?? '',
			loading: false,
			loadingModels: false,
			saving: false,
			saved: false,
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

function filterBatchSpeechModels(providerId: string, models: readonly Model[]): Model[] {
	return models.filter((model) => supportsSpeechToTextApiType(providerId, model.id, 'batch'));
}

async function loadSttState(
	t: (key: string) => string
): Promise<ModelConfigurationState> {
	const kind: ChannelModelKind = 'stt';
	try {
		const selection = await window.app.getChannelsModelSelection(kind);
		const storedProviderId = selection.providerId?.trim();
		const storedModelId = selection.modelId?.trim();
		const storedProvider = storedProviderId ? getCatalogProviderById(storedProviderId) : undefined;
		const availableProviders = mergeProviders(await window.models.transcribe.listProviders(), storedProvider);
		const modelGroups: ProviderModelGroup[] = [];
		let firstModelError: unknown;

		for (const provider of availableProviders) {
			try {
				const models = filterBatchSpeechModels(
					provider.id,
					await window.models.transcribe.listModels(provider.id)
				);
				const selectedModel =
					storedProviderId === provider.id ? models.find((model) => model.id === storedModelId) : undefined;
				const nextModels = selectedModel ? mergeModels(models, selectedModel) : models;
				if (nextModels.length > 0) modelGroups.push({ provider, models: nextModels });
			} catch (error) {
				firstModelError ??= error;
			}
		}

		const preferredGroup = modelGroups.find((group) => group.provider.id === storedProviderId) ?? modelGroups[0];
		const preferredModel =
			preferredGroup?.models.find((model) => model.id === storedModelId) ??
			preferredGroup?.models[0];

		return {
			providers: availableProviders,
			modelGroups,
			providerId: preferredGroup?.provider.id ?? '',
			modelId: preferredModel?.id ?? '',
			loading: false,
			loadingModels: false,
			saving: false,
			saved: false,
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

async function loadTtsState(
	t: (key: string) => string
): Promise<ModelConfigurationState> {
	const kind: ChannelModelKind = 'tts';
	try {
		const selection = await window.app.getChannelsModelSelection(kind);
		const storedProviderId = selection.providerId?.trim();
		const storedModelId = selection.modelId?.trim();
		const storedProvider = storedProviderId ? getCatalogProviderById(storedProviderId) : undefined;
		const availableProviders = mergeProviders(
			providerModelGroups('text-to-speech').map((group) => group.provider),
			storedProvider
		);
		const modelGroups: ProviderModelGroup[] = [];
		let firstModelError: unknown;

		for (const provider of availableProviders) {
			try {
				const models = providerModels(provider.id, 'text-to-speech');
				const nextModels =
					storedProvider?.id === provider.id && storedModelId
						? mergeModels(
								models,
								models.find((model) => model.id === storedModelId)
							)
						: models;
				if (nextModels.length > 0) modelGroups.push({ provider, models: nextModels });
			} catch (error) {
				firstModelError ??= error;
			}
		}

		const preferredGroup = modelGroups.find((group) => group.provider.id === storedProvider?.id) ?? modelGroups[0];
		const preferredModel =
			preferredGroup?.models.find((model) => model.id === storedModelId) ??
			preferredGroup?.models[0];

		return {
			providers: availableProviders,
			modelGroups,
			providerId: preferredGroup?.provider.id ?? '',
			modelId: preferredModel?.id ?? '',
			loading: false,
			loadingModels: false,
			saving: false,
			saved: false,
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

const ChannelsPage: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [channels, setChannels] = useState<CatalogService[] | null>(null);
	const [configured, setConfigured] = useState<ReadonlySet<string>>(new Set());
	const [loadError, setLoadError] = useState<string | null>(null);
	const [llmState, setLlmState] = useState<ModelConfigurationState>(initialModelConfigurationState);
	const [sttState, setSttState] = useState<ModelConfigurationState>(initialModelConfigurationState);
	const [ttsState, setTtsState] = useState<ModelConfigurationState>(initialModelConfigurationState);

	useEffect(() => {
		let mounted = true;

		void Promise.all([window.app.channels(), window.provider.listChannels()])
			.then(([services, stored]) => {
				if (!mounted) return;
				setChannels(services);
				setConfigured(
					new Set(stored.filter((entry) => entry.configured).map((entry) => entry.id))
				);
			})
			.catch((error) => {
				console.error('[ChannelsPage] Failed to load channels:', error);
				if (mounted) setLoadError(error instanceof Error ? error.message : String(error));
			});

		setLlmState({ ...initialModelConfigurationState, loading: true, loadingModels: true });
		setSttState({ ...initialModelConfigurationState, loading: true, loadingModels: true });
		setTtsState({ ...initialModelConfigurationState, loading: true, loadingModels: true });
		void Promise.all([loadLlmState(t), loadSttState(t), loadTtsState(t)]).then(
			([nextLlmState, nextSttState, nextTtsState]) => {
				if (!mounted) return;
				setLlmState(nextLlmState);
				setSttState(nextSttState);
				setTtsState(nextTtsState);
			}
		);

		return () => {
			mounted = false;
		};
	}, [t]);

	const saveLlmSelection = async (providerId: string, modelId: string): Promise<void> => {
		const group = llmState.modelGroups.find((item) => item.provider.id === providerId);
		const model = group?.models.find((item) => item.id === modelId);
		if (!group || !model) return;

		setLlmState((current) => ({
			...current,
			providerId,
			modelId,
			saving: true,
			saved: false,
			error: null,
		}));

		try {
			await window.app.setChannelsModelSelection('llm', providerId, model.id);
			setLlmState((current) => ({ ...current, saving: false, saved: true }));
		} catch (error) {
			setLlmState((current) => ({
				...current,
				saving: false,
				error: firstErrorMessage(error, t('settings.modelServices.saveError')),
			}));
		}
	};

	const saveSttSelection = async (providerId: string, modelId: string): Promise<void> => {
		const group = sttState.modelGroups.find((item) => item.provider.id === providerId);
		const model = group?.models.find((item) => item.id === modelId);
		if (!group || !model) return;

		setSttState((current) => ({
			...current,
			providerId,
			modelId,
			saving: true,
			saved: false,
			error: null,
		}));

		try {
			await window.app.setChannelsModelSelection('stt', group.provider.id, model.id);
			setSttState((current) => ({ ...current, saving: false, saved: true }));
		} catch (error) {
			setSttState((current) => ({
				...current,
				saving: false,
				error: firstErrorMessage(error, t('settings.modelServices.saveError')),
			}));
		}
	};

	const saveTtsSelection = async (providerId: string, modelId: string): Promise<void> => {
		const group = ttsState.modelGroups.find((item) => item.provider.id === providerId);
		const model = group?.models.find((item) => item.id === modelId);
		if (!group || !model) return;

		setTtsState((current) => ({
			...current,
			providerId,
			modelId,
			saving: true,
			saved: false,
			error: null,
		}));

		try {
			await window.app.setChannelsModelSelection('tts', group.provider.id, model.id);
			setTtsState((current) => ({ ...current, saving: false, saved: true }));
		} catch (error) {
			setTtsState((current) => ({
				...current,
				saving: false,
				error: firstErrorMessage(error, t('settings.modelServices.saveError')),
			}));
		}
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.channels')}
				icon={RadioTower}
				description={t('settings.channels.description')}
			/>

			{loadError && <SettingsNotice variant="destructive">{loadError}</SettingsNotice>}

			<SettingsSection
				title={t('settings.channels.configuration')}
			>
				<div className="grid gap-2">
					<ModelProviderConfiguration
						configState={llmState}
						idPrefix="channels-llm"
						triggerTitle={t('settings.channels.llmModel')}
						description={t('settings.channels.llmModelDescription')}
						showInlineError
						onChange={(nextProviderId, nextModelId) => void saveLlmSelection(nextProviderId, nextModelId)}
					/>
					<ModelProviderConfiguration
						configState={sttState}
						idPrefix="channels-stt"
						triggerTitle={t('settings.channels.sttModel')}
						description={t('settings.channels.sttModelDescription')}
						showInlineError
						onChange={(nextProviderId, nextModelId) => void saveSttSelection(nextProviderId, nextModelId)}
					/>
					<ModelProviderConfiguration
						configState={ttsState}
						idPrefix="channels-tts"
						triggerTitle={t('settings.channels.ttsModel')}
						description={t('settings.channels.ttsModelDescription')}
						showInlineError
						onChange={(nextProviderId, nextModelId) => void saveTtsSelection(nextProviderId, nextModelId)}
					/>
				</div>
			</SettingsSection>

			<ProvidersPage
				embedded
				section="channels"
				onChannelSaved={(providerId) => setConfigured((current) => new Set([...current, providerId]))}
			/>

			<SettingsSection title={t('settings.channels.available')}>
				{!channels ? (
					<SettingsLoadingRows rows={2} />
				) : (
					<Card size="sm" className="gap-0! p-0!">
						{channels.map((service, index) => (
							<Item
								key={service.id}
								as="button"
								type="button"
								onClick={() =>
									navigate(
										`/settings/channels/channelDetail/${encodeURIComponent(service.provider.id)}`
									)
								}
								variant="outline"
								size="md"
								className={cn(
									'grid cursor-pointer grid-cols-[2rem_minmax(0,1fr)_auto] items-center border-b border-border/60 text-left hover:bg-muted/50',
									index === channels.length - 1 && 'border-b-0'
								)}
							>
								<ProviderAvatar
									providerId={service.provider.id}
									name={service.provider.name}
									iconDarkUrl={service.provider.iconDarkUrl}
									iconLightUrl={service.provider.iconLightUrl}
								/>
								<ItemContent className="min-w-0">
									<ItemTitle className="w-full max-w-full truncate">
										{service.provider.name}
									</ItemTitle>
									<p className="w-full truncate text-[11px] leading-4 text-muted-foreground">
										{service.name}
									</p>
								</ItemContent>
								<ItemActions className="ml-0 flex-none justify-end gap-1.5">
									<Badge
										variant={configured.has(service.provider.id) ? 'secondary' : 'outline'}
										className="h-5 px-2 text-[10px]"
									>
										{configured.has(service.provider.id)
											? t('settings.channels.configured')
											: t('settings.channels.notConfigured')}
									</Badge>
									<ChevronRight className="size-3.5 text-muted-foreground" strokeWidth={1.8} />
								</ItemActions>
							</Item>
						))}
					</Card>
				)}
			</SettingsSection>
		</SettingsPageShell>
	);
};

export default ChannelsPage;
