import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
	AlertTriangle,
	BrainCircuit,
	ChevronRight,
	History,
	ShieldCheck,
	Library,
	Mic,
	Volume2,
	Wrench,
} from 'lucide-react';
import { modelsFor, providers } from '@/lib/providers';
import { providerIdsFor, providerModels } from '@/lib/providers';
import { ModelOptions } from '@/components/model-options';
import { updateModelOptions } from '@/lib/options';
import type { Model } from '@/lib/compat';
import type { PublicProvider } from '../../../../../../shared';
import {
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
} from '../../components';
import { ModelProviderConfiguration } from '../../components/model-configuration';
import {
	firstErrorMessage,
	initialModelConfigurationState,
	type ModelConfigurationState,
} from '../../components/model-configuration-state';
import type { ProviderModelGroup } from '../../../start/setupTypes';
import { AgentMediaModelConfiguration } from './media';
import { SETTINGS_AGENT_RESOURCE_ITEMS } from '../../navigation';

type CatalogProvider = PublicProvider;

function getCatalogProviderById(providerId: string): CatalogProvider | undefined {
	return providers().find((provider) => provider.id === providerId);
}

function getProviderLlmModels(providerId: string): Model[] {
	return providerModels(providerId, 'llm');
}

const localModelOption: Model = { id: 'local', name: 'Local model' };

function localModelProvider(): PublicProvider {
	return (
		getCatalogProviderById('ollama') ?? {
			id: 'ollama',
			name: 'Local model provider',
			baseUrl: '',
		}
	);
}

async function loadAssistantState(): Promise<ModelConfigurationState> {
	const [storedProvider, storedModelId] = await Promise.all([
		window.agent.getProvider(),
		window.agent.getModelId(),
	]);
	const storedProviderId = storedProvider?.id === 'custom' ? 'ollama' : storedProvider?.id;
	const providers = providerIdsFor('llm').flatMap((providerId) => {
		const provider = getCatalogProviderById(providerId);
		return provider && getProviderLlmModels(providerId).length > 0 ? [provider] : [];
	});
	const localModel =
		storedProviderId === 'ollama' && storedModelId
			? { id: storedModelId, name: storedModelId }
			: localModelOption;
	const modelGroups: ProviderModelGroup[] = [...providers, localModelProvider()].map(
		(provider) => ({
			provider,
			models: provider.id === 'ollama' ? [localModel] : getProviderLlmModels(provider.id),
		})
	);
	const preferredGroup =
		modelGroups.find((group) => group.provider.id === storedProviderId) ?? modelGroups[0];
	const preferredModel =
		storedProviderId === 'ollama'
			? localModel
			: (preferredGroup?.models.find((model) => model.id === storedModelId) ??
				preferredGroup?.models[0]);

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
	const [localProvider, setLocalProvider] = useState<PublicProvider>();
	const [hasLoadedLocalModels, setHasLoadedLocalModels] = useState(false);
	const model = modelsFor('llm').find(
		(item) => item.provider.id === state.providerId && item.id === state.modelId
	);
	const inputs = model?.metadata?.documentationStatus === 'verified' ? model.metadata.inputs : {};

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
	const saveModelOptions = (next: Record<string, unknown>): void => {
		setModelOptions(next);
		void window.agent.setModelOptions(next);
	};
	const loadLocalModels = async (): Promise<void> => {
		try {
			if (!window.provider) return;
			const provider = (await window.provider.list('models')).find((item) => item.id === 'custom');
			if (!provider) return;
			setLocalProvider(provider);
			const models = await window.provider.listCustomModels({
				baseUrl: provider.baseUrl,
				apiKey: provider.apiKey,
			});
			setState((current) => ({
				...current,
				modelGroups: current.modelGroups.map((group) =>
					group.provider.id === 'ollama'
						? {
								...group,
								provider: { ...group.provider, name: provider.name, baseUrl: provider.baseUrl },
								models: models.map((id) => ({ id, name: id })),
							}
						: group
				),
			}));
		} finally {
			setHasLoadedLocalModels(true);
		}
	};
	useEffect(() => {
		if (state.loading || hasLoadedLocalModels) return;
		void loadLocalModels().catch(() => undefined);
	}, [hasLoadedLocalModels, state.loading]);

	const updateModelOption = (path: readonly string[], value: unknown): void => {
		saveModelOptions(updateModelOptions(modelOptions, path, value));
	};

	const handleChange = async (nextProviderId: string, nextModelId: string): Promise<void> => {
		if (nextProviderId === 'ollama') {
			if (nextModelId === localModelOption.id) return;
			const provider =
				localProvider ??
				(await window.provider?.list('models'))?.find((item) => item.id === 'custom');
			if (!provider) return;
			setState((current) => ({
				...current,
				providerId: 'ollama',
				modelId: nextModelId,
				saving: true,
			}));
			try {
				await window.agent.setProvider({
					id: 'ollama',
					name: provider.name,
					baseUrl: provider.baseUrl,
				});
				if (!(await window.agent.setModelId(nextModelId)))
					throw new Error(t('settings.modelServices.saveError'));
				setState((current) => ({ ...current, saving: false, saved: true }));
			} catch (error) {
				setState((current) => ({
					...current,
					saving: false,
					error: firstErrorMessage(error, t('settings.modelServices.saveError')),
				}));
			}
			return;
		}
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
	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.modelServices.chatName')}
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
			</SettingsPanel>

			<SettingsPanel>
				<Link to="/settings/agent/tools" className="block hover:bg-muted/40">
					<SettingsRow
						title={t('settings.modelServices.tools')}
						description={t('settings.modelServices.toolsDescription')}
						media={<Wrench className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
						className="grid-cols-[minmax(0,1fr)_auto] border-b-0"
						actionClassName="w-auto justify-end"
						actions={<ChevronRight className="size-4 text-muted-foreground" />}
					/>
				</Link>
			</SettingsPanel>

			<SettingsPanel>
				{SETTINGS_AGENT_RESOURCE_ITEMS.map((item) => (
					<Link key={item.path} to={item.path} className="block hover:bg-muted/40">
						<SettingsRow
							title={t(item.labelKey)}
							media={
								<item.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
							}
							description={t(item.descriptionKey)}
							className="grid-cols-[minmax(0,1fr)_auto] border-b-0"
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
			</SettingsPanel>
		</SettingsPageShell>
	);
};

export default AssistantPage;
