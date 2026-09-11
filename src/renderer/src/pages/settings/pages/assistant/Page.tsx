import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
	AlertTriangle,
	BrainCircuit,
	ChevronRight,
	Image as ImageIcon,
	HeartPulse,
	History,
	ShieldCheck,
	Library,
	BookOpenText,
	Music2,
	Mic,
	Radio,
	Search as SearchIcon,
	Video,
	Volume2,
} from 'lucide-react';
import { modelsFor, providers } from '@/lib/providers';
import { providerIdsFor, providerModels } from '@/lib/providers';
import { ModelOptions } from '@/components/model-options';
import { updateModelOptions } from '@/lib/options';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import type { Model } from '@/lib/compat';
import type { PublicProvider } from '../../../../../../shared';
import {
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
} from '../../components';
import { ModelProviderConfiguration } from '../../components/model-configuration';
import {
	firstErrorMessage,
	initialModelConfigurationState,
	type ModelConfigurationState,
} from '../../components/model-configuration-state';
import type { ProviderModelGroup } from '../../../start/setupTypes';
import { AgentMediaModelConfiguration } from './media';
import RealtimeConversationConfiguration from './conversation';
import { SETTINGS_AGENT_RESOURCE_ITEMS } from '../../navigation';
import { SEARCH_ENGINES } from '../search/catalog';
import type { SearchEngineId, SearchSettings } from '../../../../../../shared/search_types';

type CatalogProvider = PublicProvider;

function getCatalogProviderById(providerId: string): CatalogProvider | undefined {
	return providers().find((provider) => provider.id === providerId);
}

function getProviderLlmModels(providerId: string): Model[] {
	return providerModels(providerId, 'llm');
}

async function loadAssistantState(): Promise<ModelConfigurationState> {
	const [storedProvider, storedModelId] = await Promise.all([
		window.agent.getProvider(),
		window.agent.getModelId(),
	]);
	const providers = providerIdsFor('llm').flatMap((providerId) => {
		const provider = getCatalogProviderById(providerId);
		return provider && getProviderLlmModels(providerId).length > 0 ? [provider] : [];
	});
	const modelGroups: ProviderModelGroup[] = providers.map((provider) => ({
		provider,
		models: getProviderLlmModels(provider.id),
	}));
	const preferredGroup =
		modelGroups.find((group) => group.provider.id === storedProvider?.id) ?? modelGroups[0];
	const preferredModel =
		preferredGroup?.models.find((model) => model.id === storedModelId) ?? preferredGroup?.models[0];

	return {
		providers,
		modelGroups,
		providerId: preferredGroup?.provider.id ?? '',
		modelId: preferredModel?.id ?? '',
		loading: false,
		loadingModels: false,
		saving: false,
		saved: false,
		error: null,
	};
}

const AssistantPage: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [state, setState] = useState<ModelConfigurationState>(initialModelConfigurationState);
	const [modelOptions, setModelOptions] = useState<Record<string, unknown>>({});
	const [searchSettings, setSearchSettings] = useState<SearchSettings | null>(null);
	const [searchEngineError, setSearchEngineError] = useState<string | null>(null);
	const [searchSavingEngineId, setSearchSavingEngineId] = useState<SearchEngineId | null>(null);
	const model = modelsFor('llm').find(
		(item) => item.provider.id === state.providerId && item.id === state.modelId
	);
	const inputs = model?.metadata?.documentationStatus === 'verified' ? model.metadata.inputs : {};
	const selectedSearchEngine = SEARCH_ENGINES.find(
		(engine) => engine.id === searchSettings?.engineId
	);
	const selectedSearchEngineDescription = selectedSearchEngine
		? t(selectedSearchEngine.descriptionKey)
		: t('settings.searchEngine.defaultDescription');

	useEffect(() => {
		let mounted = true;
		void loadAssistantState()
			.then((nextState) => {
				if (mounted) setState(nextState);
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
	}, [t]);
	useEffect(() => {
		void window.agent.getModelOptions().then(setModelOptions);
	}, []);
	useEffect(() => {
		let mounted = true;
		void window.search.getSettings().then(
			(next) => {
				if (!mounted) return;
				setSearchSettings(next);
				setSearchEngineError(null);
			},
			(error) => {
				if (!mounted) return;
				setSearchEngineError(firstErrorMessage(error, t('settings.searchEngine.errors.load')));
			}
		);
		return () => {
			mounted = false;
		};
	}, [t]);

	const saveModelOptions = (next: Record<string, unknown>): void => {
		setModelOptions(next);
		void window.agent.setModelOptions(next);
	};

	const updateModelOption = (path: readonly string[], value: unknown): void => {
		saveModelOptions(updateModelOptions(modelOptions, path, value));
	};

	const handleChange = async (nextProviderId: string, nextModelId: string): Promise<void> => {
		const group = state.modelGroups.find((item) => item.provider.id === nextProviderId);
		const model = group?.models.find((item) => item.id === nextModelId);
		if (!group || !model) return;
		setModelOptions({});
		setState((current) => ({
			...current,
			providerId: nextProviderId,
			modelId: nextModelId,
			saving: true,
			saved: false,
			error: null,
		}));
		try {
			const didSave =
				(await window.agent.setProvider(group.provider)) &&
				(await window.agent.setModelId(model.id));
			if (!didSave) throw new Error(t('settings.modelServices.saveError'));
			await window.agent.setModelOptions({});
			setModelOptions({});
			setState((current) => ({ ...current, saving: false, saved: true }));
		} catch (error) {
			setState((current) => ({
				...current,
				saving: false,
				error: firstErrorMessage(error, t('settings.modelServices.saveError')),
			}));
		}
	};

	const handleSearchEngineChange = (value: SearchEngineId | null): void => {
		if (!value) return;
		const engineId = value;
		setSearchSavingEngineId(engineId);
		setSearchEngineError(null);
		void window.search
			.selectEngine(engineId)
			.then(
				(next) => {
					setSearchSettings(next);
				},
				(error) => {
					setSearchEngineError(firstErrorMessage(error, t('settings.searchEngine.errors.select')));
				}
			)
			.finally(() => {
				setSearchSavingEngineId(null);
			});
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.modelServices.assistantName')}
				description={t('settings.modelServices.kucedrDescription')}
			/>

			{state.error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{state.error}
				</SettingsNotice>
			)}

			<SettingsPanel>
				<ModelProviderConfiguration
					configState={state}
					idPrefix="assistant"
					triggerTitle={t('settings.modelServices.llmModel')}
					description={t('settings.modelServices.modelDescription')}
					showIcon
					icon={BrainCircuit}
					showFieldLabel={false}
					grouped
					showSelectedModel
					buttonDropdown
					showContentSeparator={false}
					onChange={(providerId, modelId) => void handleChange(providerId, modelId)}
				>
					<ModelOptions
						key={`${state.providerId}:${state.modelId}`}
						inputs={inputs}
						values={modelOptions}
						inlineAdvanced
						onChange={updateModelOption}
					/>
				</ModelProviderConfiguration>

				<RealtimeConversationConfiguration
					icon={Radio}
					showFieldLabel={false}
					showSelectedModel
					buttonDropdown
					showContentSeparator={false}
				/>

				<AgentMediaModelConfiguration
					api={window.models.transcribe}
					capability="speech-to-text"
					idPrefix="agent-transcription"
					title={t('settings.modelServices.transcriptionName')}
					description={t('settings.modelServices.transcriptionDescription')}
					showIcon
					icon={Mic}
					showFieldLabel={false}
					grouped
					showSelectedModel
					buttonDropdown
					showContentSeparator={false}
					showOptions={false}
				/>

				<AgentMediaModelConfiguration
					api={window.models.voice}
					capability="text-to-speech"
					idPrefix="agent-voice"
					title={t('settings.modelServices.voiceName')}
					description={t('settings.modelServices.textToSpeechModelDescription')}
					showIcon
					icon={Volume2}
					showFieldLabel={false}
					grouped
					showSelectedModel
					buttonDropdown
					showContentSeparator={false}
					inlineAdvanced
				/>
			</SettingsPanel>

			<SettingsSection title={t('settings.modelServices.tools')}>
				<SettingsPanel>
					<AgentMediaModelConfiguration
						api={window.models.image}
						capability="text-to-image"
						idPrefix="agent-image"
						title={t('settings.modelServices.imageAssistantName')}
						description={t('settings.modelServices.imageModelDescription')}
						showIcon
						icon={ImageIcon}
						showFieldLabel={false}
						grouped
						showSelectedModel
						buttonDropdown
						showContentSeparator={false}
						inlineAdvanced
					/>

					<AgentMediaModelConfiguration
						api={window.models.sound}
						capability="text-to-audio"
						idPrefix="agent-audio"
						title={t('settings.modelServices.musicCreatorName')}
						description={t('settings.modelServices.musicModelDescription')}
						showIcon
						icon={Music2}
						showFieldLabel={false}
						grouped
						showSelectedModel
						buttonDropdown
						showContentSeparator={false}
						inlineAdvanced
					/>

					<AgentMediaModelConfiguration
						api={window.models.video}
						capability="text-to-video"
						idPrefix="agent-video"
						title={t('settings.modelServices.videoCreatorName')}
						description={t('settings.modelServices.videoModelDescription')}
						showIcon
						icon={Video}
						showFieldLabel={false}
						grouped
						showSelectedModel
						buttonDropdown
						showContentSeparator={false}
						inlineAdvanced
					/>
					<Collapsible className="min-w-0 max-w-full overflow-hidden">
						<div className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40">
							<CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-4 text-left">
								<SearchIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
								<div className="min-w-0 flex-1">
									<div className="truncate text-[13px] font-medium leading-4 text-foreground">
										{t('settings.tabs.searchEngine')}
									</div>
									<p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
										{selectedSearchEngineDescription}
									</p>
								</div>
							</CollapsibleTrigger>
							<div className="shrink-0">
								<Select
									value={searchSettings?.engineId ?? null}
									onValueChange={handleSearchEngineChange}
									disabled={!searchSettings || searchSavingEngineId !== null}
								>
									<SelectTrigger
										className="w-40 max-w-full text-xs [&_svg]:size-3"
										aria-label={t('settings.tabs.searchEngine')}
									>
										<SelectValue placeholder={t('settings.searchEngine.defaultTitle')}>
											{selectedSearchEngine?.name}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										{SEARCH_ENGINES.map((engine) => (
											<SelectItem
												key={engine.id}
												value={engine.id}
												disabled={!searchSettings?.configured[engine.id]}
											>
												{engine.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						<CollapsibleContent>
							{searchEngineError && (
								<SettingsNotice variant="destructive" icon={AlertTriangle} className="mx-3 mt-3">
									{searchEngineError}
								</SettingsNotice>
							)}
						</CollapsibleContent>
					</Collapsible>
				</SettingsPanel>
			</SettingsSection>

			<SettingsPanel>
				{SETTINGS_AGENT_RESOURCE_ITEMS.map((item) => (
					<Link key={item.path} to={item.path} className="block hover:bg-muted/40">
						<SettingsRow
							title={t(item.labelKey)}
							media={
								<item.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
							}
							description={t(item.descriptionKey)}
							className="grid-cols-[minmax(0,1fr)_auto]"
							actionClassName="w-auto justify-end"
							actions={<ChevronRight className="size-4 text-muted-foreground" />}
						/>
					</Link>
				))}
			</SettingsPanel>

			<SettingsPanel>
				<div
					role="button"
					tabIndex={0}
					className="cursor-pointer hover:bg-muted/40"
					onClick={() => navigate('/settings/agent/chathistory')}
					onKeyDown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							navigate('/settings/agent/chathistory');
						}
					}}
				>
					<SettingsRow
						title={t('settings.chatHistory.title')}
						media={<History className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
						description={t('settings.chatHistory.description')}
						className="grid-cols-[minmax(0,1fr)_auto] border-b-0"
						actionClassName="w-auto justify-end"
						actions={<ChevronRight className="size-4 text-muted-foreground" />}
					/>
				</div>
			</SettingsPanel>

			<SettingsPanel>
				<div
					role="button"
					tabIndex={0}
					className="cursor-pointer hover:bg-muted/40"
					onClick={() => navigate('/settings/agent/health')}
					onKeyDown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							navigate('/settings/agent/health');
						}
					}}
				>
					<SettingsRow
						title={t('settings.tabs.health')}
						media={
							<HeartPulse className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
						}
						description={t('settings.overview.descriptions.health')}
						className="grid-cols-[minmax(0,1fr)_auto]"
						actionClassName="w-auto justify-end"
						actions={<ChevronRight className="size-4 text-muted-foreground" />}
					/>
				</div>
				<div
					role="button"
					tabIndex={0}
					className="cursor-pointer hover:bg-muted/40"
					onClick={() => navigate('/settings/agent/permissions')}
					onKeyDown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							navigate('/settings/agent/permissions');
						}
					}}
				>
					<SettingsRow
						title={t('settings.tabs.permissions')}
						media={
							<ShieldCheck className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
						}
						description={t('settings.overview.descriptions.permissions')}
						className="grid-cols-[minmax(0,1fr)_auto] border-b-0"
						actionClassName="w-auto justify-end"
						actions={<ChevronRight className="size-4 text-muted-foreground" />}
					/>
				</div>
			</SettingsPanel>

			<SettingsPanel>
				<div
					role="button"
					tabIndex={0}
					className="cursor-pointer hover:bg-muted/40"
					onClick={() => navigate('/settings/agent/rag')}
					onKeyDown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							navigate('/settings/agent/rag');
						}
					}}
				>
					<SettingsRow
						title={t('settings.rag.title')}
						media={<Library className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
						description={t('settings.overview.descriptions.rag')}
						className="grid-cols-[minmax(0,1fr)_auto]"
						actionClassName="w-auto justify-end"
						actions={<ChevronRight className="size-4 text-muted-foreground" />}
					/>
				</div>
				<div
					role="button"
					tabIndex={0}
					className="cursor-pointer hover:bg-muted/40"
					onClick={() => navigate('/settings/agent/llm-wiki')}
					onKeyDown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							navigate('/settings/agent/llm-wiki');
						}
					}}
				>
					<SettingsRow
						title={t('settings.wiki.title')}
						media={
							<BookOpenText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
						}
						description={t('settings.wiki.description')}
						className="grid-cols-[minmax(0,1fr)_auto] border-b-0"
						actionClassName="w-auto justify-end"
						actions={<ChevronRight className="size-4 text-muted-foreground" />}
					/>
				</div>
			</SettingsPanel>
		</SettingsPageShell>
	);
};

export default AssistantPage;
