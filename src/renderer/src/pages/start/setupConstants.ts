import { getProviderApiConfigurationUrl } from '../../../../shared';
import {
	providerIdsFor,
	providerModels,
	providers,
	searchProviders,
	webSearches,
} from '@/lib/providers';
import type { ModelCapability } from '../../../../shared/model_types';
import type { PublicProvider } from '../../../../shared';
import type { Model } from '@/lib/compat';
import type {
	ModelServiceDefinition,
	ModelServiceState,
	ModelServiceStateMap,
	ProviderCatalogItem,
	ProviderModelGroup,
	ProviderOption,
	OnboardingStep,
	SetupStep,
} from './setupTypes';

type CatalogProvider = PublicProvider;

function toModelGroups(type: ModelCapability): ProviderModelGroup[] {
	return providerIdsFor(type).flatMap((providerId) => {
		const provider = providers().find((item) => item.id === providerId);
		const models = providerModels(providerId, type);
		return provider && models.length > 0 ? [{ provider, models }] : [];
	});
}

function getLlmModelGroups(): ProviderModelGroup[] {
	return toModelGroups('llm');
}

type ModelIdApi = {
	getProviderId: () => Promise<string | undefined>;
	setProviderId: (providerId: string) => Promise<void>;
	getModelId: () => Promise<string | undefined>;
	setModelId: (modelId: string) => Promise<void>;
};

function toIdSelectionHandlers(
	getApi: () => ModelIdApi
): Pick<ModelServiceDefinition, 'getSelection' | 'saveSelection'> {
	return {
		getSelection: async () => {
			const api = getApi();
			const [providerId, modelId] = await Promise.all([api.getProviderId(), api.getModelId()]);
			return providerId && modelId ? { providerId, modelId } : undefined;
		},
		saveSelection: async (provider, model) => {
			const api = getApi();
			await api.setProviderId(provider.id);
			await api.setModelId(model.id);
			return true;
		},
	};
}

async function getTranscriptionModelGroups(): Promise<ProviderModelGroup[]> {
	const providers = await window.models.transcribe.listProviders();
	const modelGroups: ProviderModelGroup[] = [];
	for (const provider of providers) {
		const models = await window.models.transcribe.listModels(provider.id);
		if (models.length > 0) modelGroups.push({ provider, models });
	}
	return modelGroups;
}

export const MODEL_SERVICE_DEFINITIONS: readonly ModelServiceDefinition[] = [
	{
		id: 'assistant',
		title: 'Model',
		description: 'Chat, reasoning, and planning.',
		getSelection: async () => {
			const [provider, modelId] = await Promise.all([
				window.agent.getProvider(),
				window.agent.getModelId(),
			]);
			return provider && modelId ? { providerId: provider.id, modelId } : undefined;
		},
		loadModelGroups: () => Promise.resolve(getLlmModelGroups()),
		saveSelection: async (provider, model) => {
			await window.agent.setProvider(provider);
			return window.agent.setModelId(model.id);
		},
	},
	{
		id: 'health',
		title: 'Health check',
		description: 'Scheduled health checks.',
		getSelection: async () => {
			const settings = await window.agent.healthGetSettings();
			return settings.providerId && settings.modelId
				? { providerId: settings.providerId, modelId: settings.modelId }
				: undefined;
		},
		loadModelGroups: () => Promise.resolve(getLlmModelGroups()),
		saveSelection: async (provider, model) => {
			await window.agent.healthSaveSettings({ providerId: provider.id, modelId: model.id });
			return true;
		},
	},
	{
		id: 'tasks',
		title: 'Tasks',
		description: 'Scheduled tasks and automations.',
		getSelection: async () => {
			const runtime = await window.tasks.getRuntime();
			return runtime?.providerId && runtime.modelId
				? { providerId: runtime.providerId, modelId: runtime.modelId }
				: undefined;
		},
		loadModelGroups: () => Promise.resolve(getLlmModelGroups()),
		saveSelection: async (provider, model) => {
			await window.tasks.setRuntime(provider.id, model.id);
			return true;
		},
	},
	{
		id: 'voice',
		title: 'Voice',
		description: 'Read responses aloud.',
		saveOnChange: true,
		loadModelGroups: () => Promise.resolve(toModelGroups('text-to-speech')),
		...toIdSelectionHandlers(() => window.models.voice),
	},
	{
		id: 'transcription',
		title: 'Transcription',
		description: 'Speech to text.',
		saveOnChange: true,
		getSelection: async () => {
			const selection = await window.models.transcribe.getSelection();
			return selection
				? { providerId: selection.provider.id, modelId: selection.model.id }
				: undefined;
		},
		loadModelGroups: getTranscriptionModelGroups,
		saveSelection: (provider, model) =>
			window.models.transcribe.saveSelection(provider.id, model.id),
	},
	{
		id: 'image',
		title: 'Image',
		description: 'Generate images.',
		loadModelGroups: () => Promise.resolve(toModelGroups('text-to-image')),
		...toIdSelectionHandlers(() => window.models.image),
	},
	{
		id: 'audio',
		title: 'Audio',
		description: 'Generate music and sounds.',
		loadModelGroups: () => Promise.resolve(toModelGroups('text-to-audio')),
		...toIdSelectionHandlers(() => window.models.sound),
	},
	{
		id: 'video',
		title: 'Video',
		description: 'Generate videos.',
		loadModelGroups: () => Promise.resolve(toModelGroups('text-to-video')),
		...toIdSelectionHandlers(() => window.models.video),
	},
];

export const SETUP_STEPS: readonly SetupStep[] = ['modelProvider', 'search', 'models'];

export const ONBOARDING_STEPS: readonly OnboardingStep[] = SETUP_STEPS;

export const ONBOARDING_STEP_TITLES: Record<OnboardingStep, string> = {
	landing: 'Welcome',
	auth: 'Account',
	modelProvider: 'Model',
	search: 'Search',
	models: 'Models',
};

export const MASKED_API_KEY_LABEL = 'sk-************' as const;

export const STEP_COPY: Record<SetupStep, { title: string; description: string }> = {
	modelProvider: {
		title: 'Model API keys',
		description:
			'Add an API key for the model provider you want to use. You can connect more providers at any time.',
	},
	search: {
		title: 'Search Engine',
		description: 'Add an API key for the search engine you want Kucedr to use.',
	},
	models: {
		title: 'Assistant setup',
		description:
			'Choose the model each service should use. Only the model is required — you can change any of these later in settings.',
	},
};

function normalizeProvider(provider: CatalogProvider, index: number): ProviderOption {
	const value = provider.id || `provider-${index}`;
	const label = provider.name || value;
	return { label, value };
}

export function providerOptions(): ProviderOption[] {
	return providers().map((provider, index) => normalizeProvider(provider, index));
}

export function supportedProviderIds(): Set<string> {
	return new Set(providerOptions().map((provider) => provider.value));
}

export function actionableProviderCatalog(): readonly ProviderCatalogItem[] {
	return providers().map((provider) => ({
		id: provider.id,
		name: provider.name,
		capabilities: provider.capabilities ?? 'AI provider',
		supported: true,
		apiConfigurationUrl: getProviderApiConfigurationUrl(provider),
		iconDarkUrl: provider.iconDarkUrl,
		iconLightUrl: provider.iconLightUrl,
	}));
}

/** Providers with at least one web search service, shaped like the models catalog cards. */
export function actionableSearchCatalog(): readonly ProviderCatalogItem[] {
	return searchProviders().map((provider) => ({
		id: provider.id,
		name: provider.name,
		capabilities:
			webSearches()
				.filter((entry) => entry.provider.id === provider.id)
				.map((entry) => entry.name)
				.join(' - ') || 'Web search',
		supported: true,
		apiConfigurationUrl: getProviderApiConfigurationUrl(provider),
		iconDarkUrl: provider.iconDarkUrl,
		iconLightUrl: provider.iconLightUrl,
	}));
}

export function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message.trim().length > 0) {
		return error.message;
	}
	return fallback;
}

export function getProviderCatalogItem(providerId: string): ProviderCatalogItem {
	return (
		actionableProviderCatalog().find((provider) => provider.id === providerId) ?? {
			id: providerId,
			name:
				providerOptions().find((provider) => provider.value === providerId)?.label ?? providerId,
			capabilities: 'Chat',
			supported: supportedProviderIds().has(providerId),
		}
	);
}

export function createInitialModelServiceState(): ModelServiceStateMap {
	return MODEL_SERVICE_DEFINITIONS.reduce(
		(acc, service) => ({
			...acc,
			[service.id]: { providerId: '', modelId: '', modelGroups: [] },
		}),
		{} as ModelServiceStateMap
	);
}

export function getSelectedServiceModel(
	serviceState: ModelServiceState
): { provider: PublicProvider; model: Model } | undefined {
	const selectedProvider = serviceState.modelGroups.find(
		(group) => group.provider.id === serviceState.providerId
	);
	const selectedModel = selectedProvider?.models.find((model) => model.id === serviceState.modelId);
	return selectedProvider && selectedModel
		? { provider: selectedProvider.provider, model: selectedModel }
		: undefined;
}
