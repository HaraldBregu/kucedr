import {
	normalizeProviderId,
	type CatalogService,
	type CatalogWebSearch,
	type PublicProvider,
} from '@shared/provider_types';
import type {
	CatalogModel,
	ModelCapability,
	ProviderModel,
	SpeechToTextApiType,
} from '@shared/model_types';

let catalog: readonly CatalogModel[] = [];
let databaseCatalog: readonly CatalogService[] = [];
let webSearchCatalog: readonly CatalogWebSearch[] = [];
let mcpCatalog: readonly CatalogService[] = [];
let channelCatalog: readonly CatalogService[] = [];

export async function loadModels(): Promise<void> {
	[catalog, databaseCatalog, webSearchCatalog, mcpCatalog, channelCatalog] = await Promise.all([
		window.app.models(),
		window.app.databases(),
		window.app.webSearches(),
		window.app.mcps(),
		window.app.channels(),
	]);
}

export function models(): readonly CatalogModel[] {
	return catalog;
}

export function modelsFor(type: ModelCapability): CatalogModel[] {
	return catalog.filter((model) => model.type === type);
}

function uniqueProviders(entries: readonly { provider: PublicProvider }[]): PublicProvider[] {
	const unique = new Map<string, PublicProvider>();
	for (const entry of entries) {
		if (!unique.has(entry.provider.id)) unique.set(entry.provider.id, entry.provider);
	}
	return [...unique.values()];
}

/** One record per provider, derived from the models they serve. */
export function providers(): readonly PublicProvider[] {
	return uniqueProviders(catalog);
}

export function databases(): readonly CatalogService[] {
	return databaseCatalog;
}

/** One record per provider, derived from the databases they serve. */
export function databaseProviders(): readonly PublicProvider[] {
	return uniqueProviders(databaseCatalog);
}

export function webSearches(): readonly CatalogWebSearch[] {
	return webSearchCatalog;
}

/** One record per provider, derived from the web search catalog. */
export function searchProviders(): readonly PublicProvider[] {
	return uniqueProviders(webSearchCatalog);
}

export function mcps(): readonly CatalogService[] {
	return mcpCatalog;
}

export function mcpProviders(): readonly PublicProvider[] {
	return uniqueProviders(mcpCatalog);
}

export function channels(): readonly CatalogService[] {
	return channelCatalog;
}

/** One record per provider, derived from the channels they serve. */
export function channelProviders(): readonly PublicProvider[] {
	return uniqueProviders(channelCatalog);
}

export function providerIdsFor(type: ModelCapability): string[] {
	return [...new Set(modelsFor(type).map((model) => model.provider.id))];
}

export function providerModels(providerId: string, type: ModelCapability): ProviderModel[] {
	const normalized = normalizeProviderId(providerId);
	return catalog
		.filter((model) => model.provider.id === normalized && model.type === type)
		.map((model) => ({
			id: model.id,
			name: model.name,
			...(model.metadata ? { metadata: model.metadata } : {}),
			...(model.apiTypes ? { apiTypes: model.apiTypes } : {}),
			...(model.realtime ? { realtime: model.realtime } : {}),
		}));
}

/** Provider marked `default` for a capability, else the first one declaring it. */
export function defaultProviderId(type: ModelCapability): string | undefined {
	const typed = modelsFor(type);
	return (typed.find((model) => model.default) ?? typed[0])?.provider.id;
}

function findModel(providerId: string, modelId: string): CatalogModel | undefined {
	const normalized = normalizeProviderId(providerId);
	const id = modelId.trim();
	return catalog.find(
		(model) =>
			model.provider.id === normalized && model.type === 'speech-to-text' && model.id === id
	);
}

export function speechToTextApiTypes(
	providerId: string,
	modelId: string
): readonly SpeechToTextApiType[] {
	return findModel(providerId, modelId)?.apiTypes ?? [];
}

export function supportsSpeechToTextApiType(
	providerId: string,
	modelId: string,
	apiType: SpeechToTextApiType
): boolean {
	return speechToTextApiTypes(providerId, modelId).includes(apiType);
}

export function isRealtimeSpeechToTextModel(providerId: string, modelId: string): boolean {
	return findModel(providerId, modelId)?.realtime === true;
}
