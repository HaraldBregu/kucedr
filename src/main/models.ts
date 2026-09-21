import path from 'node:path';
import { existsSync, readdirSync, readFileSync, watch } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
	normalizeProviderId,
	type CatalogEntryModel,
	type CatalogEntryWebSearch,
	type CatalogService,
	type CatalogWebSearch,
	type ProviderManifest,
	type PublicProvider,
} from '../shared/provider_types';
import type {
	CatalogModel,
	ModelCapability,
	ProviderModel,
	SpeechToTextApiType,
} from '../shared/model_types';
import { userDataLocation } from './shared/user_data_location';
import { parseProviderManifest } from '../shared/providers/validation';
import { resourceRoot } from './shared/resource_root';

interface Catalog {
	readonly models: readonly CatalogModel[];
	readonly databases: readonly CatalogService[];
	readonly webSearches: readonly CatalogWebSearch[];
	readonly mcps: readonly CatalogService[];
}

let cache: Catalog | undefined;
let watching = false;

function loadCatalog(): Catalog {
	// ponytail: without a watcher there is no safe cache — read fresh every call
	if (!watching) return readCatalog();
	if (!cache) cache = readCatalog();
	return cache;
}

/** Every model in Kucedr's local provider catalog, each carrying the provider that serves it. */
export function loadModels(): readonly CatalogModel[] {
	return loadCatalog().models;
}

/** Every database across ~/.kucedr/providers/<id>/manifest.json. */
export function loadDatabases(): readonly CatalogService[] {
	return loadCatalog().databases;
}

/** Every web search provider across ~/.kucedr/providers/<id>/manifest.json. */
export function loadWebSearches(): readonly CatalogWebSearch[] {
	return loadCatalog().webSearches;
}

/** Every MCP service across bundled and local provider manifests. */
export function loadMcps(): readonly CatalogService[] {
	return loadCatalog().mcps;
}

export function refreshProviderCatalog(): void {
	cache = undefined;
}

/** Keep the local provider catalog in sync; onChange fires after edits settle. */
export function watchModels(onChange: () => void): void {
	if (watching) return;
	try {
		let timer: NodeJS.Timeout | undefined;
		watch(providersDir(), { recursive: true }, () => {
			refreshProviderCatalog();
			clearTimeout(timer);
			timer = setTimeout(onChange, 100);
		});
		watching = true;
	} catch {
		// ponytail: watcher unavailable → loadModels() keeps reading fresh
	}
}

export function modelsFor(type: ModelCapability): CatalogModel[] {
	return loadModels().filter((model) => model.type === type);
}

export function findModel(
	providerId: string,
	type: ModelCapability,
	modelId: string
): CatalogModel | undefined {
	const normalized = normalizeProviderId(providerId);
	const id = modelId.trim();
	return loadModels().find(
		(model) => model.provider.id === normalized && model.type === type && model.id === id
	);
}

/** One record per provider, derived from the models they serve. */
export function loadProviders(): readonly PublicProvider[] {
	const unique = new Map<string, PublicProvider>();
	for (const model of loadModels()) {
		if (!unique.has(model.provider.id)) unique.set(model.provider.id, model.provider);
	}
	return [...unique.values()].sort(compareByName);
}

export function providerModels(providerId: string, type: ModelCapability): ProviderModel[] {
	const normalized = normalizeProviderId(providerId);
	return loadModels()
		.filter((model) => model.provider.id === normalized && model.type === type)
		.map(toProviderModel);
}

export function providerIdsFor(type: ModelCapability): string[] {
	return [...new Set(modelsFor(type).map((model) => model.provider.id))];
}

export function supportsCapability(providerId: string, type: ModelCapability): boolean {
	const normalized = normalizeProviderId(providerId);
	return loadModels().some((model) => model.provider.id === normalized && model.type === type);
}

/** Provider marked `default` for a capability, else the first one declaring it. */
export function defaultProviderId(type: ModelCapability): string | undefined {
	const models = modelsFor(type);
	return (models.find((model) => model.default) ?? models[0])?.provider.id;
}

export function speechToTextBaseUrl(providerId: string): string {
	const model = modelsFor('speech-to-text').find(
		(entry) => entry.provider.id === normalizeProviderId(providerId)
	);
	if (!model) throw new Error(`No speech-to-text entry for provider: ${providerId}`);
	return model.url ?? '';
}

export function speechToTextSampleRate(providerId: string): number | undefined {
	return modelsFor('speech-to-text').find(
		(entry) => entry.provider.id === normalizeProviderId(providerId)
	)?.sampleRate;
}

export function speechToTextApiTypes(
	providerId: string,
	modelId: string
): readonly SpeechToTextApiType[] {
	return findModel(providerId, 'speech-to-text', modelId)?.apiTypes ?? [];
}

export function supportsSpeechToTextApiType(
	providerId: string,
	modelId: string,
	apiType: SpeechToTextApiType
): boolean {
	return speechToTextApiTypes(providerId, modelId).includes(apiType);
}

export function realtimeSpeechToTextModelId(providerId: string): string {
	const normalized = normalizeProviderId(providerId);
	const model = modelsFor('speech-to-text').find(
		(entry) => entry.provider.id === normalized && entry.realtime
	);
	if (!model) throw new Error(`No realtime speech-to-text model for provider: ${providerId}`);
	return model.id;
}

export function isRealtimeSpeechToTextModel(providerId: string, modelId: string): boolean {
	return findModel(providerId, 'speech-to-text', modelId)?.realtime === true;
}

function toProviderModel(model: CatalogModel): ProviderModel {
	return {
		id: model.id,
		name: model.name,
		...(model.apiTypes ? { apiTypes: model.apiTypes } : {}),
		...(model.realtime ? { realtime: model.realtime } : {}),
	};
}

function compareByName<T extends { id: string; name: string }>(left: T, right: T): number {
	return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function toModelCapability(type: string): ModelCapability | undefined {
	const capabilities: Record<string, ModelCapability> = {
		'large-language-model': 'llm',
		'research-chat-model': 'research-chat',
		'speech-to-text-model': 'speech-to-text',
		'text-to-speech-model': 'text-to-speech',
		'realtime-voice-model': 'realtime-voice',
		'text-to-image-model': 'text-to-image',
		'text-to-video-model': 'text-to-video',
		'text-to-audio-model': 'text-to-audio',
		'embedding-model': 'embedding',
	};
	return capabilities[type];
}

function iconUrl(providerDir: string, iconPath: string | undefined): string | undefined {
	if (!iconPath) return undefined;
	const filePath = path.resolve(providerDir, iconPath.replace(/^\/+/, ''));
	if (!filePath.startsWith(`${providerDir}${path.sep}`) || !existsSync(filePath)) return undefined;
	return `local-resource://file${pathToFileURL(filePath).pathname}`;
}

function toPublicProvider(entry: ProviderManifest, providerDir: string): PublicProvider {
	const baseUrl = entry.services.find((service) => service.url?.startsWith('http'))?.url ?? '';
	const iconDarkUrl = iconUrl(providerDir, entry.icon_dark_url);
	const iconLightUrl = iconUrl(providerDir, entry.icon_light_url);
	return {
		id: entry.providerId,
		name: entry.providerName,
		baseUrl,
		...(entry.apiKeyUrl ? { apiKeyUrl: entry.apiKeyUrl } : {}),
		...(iconDarkUrl ? { iconDarkUrl } : {}),
		...(iconLightUrl ? { iconLightUrl } : {}),
	};
}

export function providersDir(): string {
	return path.join(userDataLocation(), 'providers');
}

function bundledProvidersDir(): string {
	return path.join(resourceRoot(), 'resources/providers');
}

function readCatalog(): Catalog {
	const models: CatalogModel[] = [];
	const databases: CatalogService[] = [];
	const webSearches: CatalogWebSearch[] = [];
	const mcps: CatalogService[] = [];
	const manifests = new Map<string, { entry: ProviderManifest; providerDir: string }>();

	for (const directory of [bundledProvidersDir(), providersDir()]) {
		if (!existsSync(directory)) continue;
		for (const dirent of readdirSync(directory, { withFileTypes: true })) {
			if (!dirent.isDirectory()) continue;
			try {
				const providerDir = path.join(directory, dirent.name);
				const manifestPath = path.join(providerDir, 'manifest.json');
				if (!existsSync(manifestPath)) continue;
				const entry = parseProviderManifest(JSON.parse(readFileSync(manifestPath, 'utf-8')));
				if (!entry) continue;
				manifests.set(normalizeProviderId(entry.providerId), { entry, providerDir });
			} catch {
				// ponytail: a provider dir mid-edit (malformed JSON) drops out until fixed
			}
		}
	}

	for (const { entry, providerDir } of manifests.values()) {
		const provider = toPublicProvider(entry, providerDir);
		const modelEntries = entry.services.flatMap((service): CatalogEntryModel[] => {
			const type = toModelCapability(service.type);
			return type ? [{ ...service, type }] : [];
		});
		models.push(...modelEntries.map((model) => ({ ...model, provider })));
		databases.push(
			...entry.services
				.filter((service) => service.type === 'database')
				.map((service) => ({ ...service, provider }))
		);
		webSearches.push(
			...entry.services
				.filter((service): service is CatalogEntryWebSearch => service.type === 'web-search')
				.map((search) => ({ ...search, provider }))
		);
		mcps.push(
			...entry.services
				.filter((service) => service.type === 'mcp')
				.map((service) => ({ ...service, provider }))
		);
	}

	return {
		models: models.sort(compareByName),
		databases: databases.sort(compareByName),
		webSearches: webSearches.sort(compareByName),
		mcps: mcps.sort(compareByName),
	};
}
