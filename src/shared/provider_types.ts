import type { ModelCapability, ModelMetadata, ProviderModel } from './model_types';

export interface ProviderApiConfiguration {
	readonly credentialType: string | null;
	readonly apiKeyManagementUrl: string | null;
	readonly configurationDocsUrl: string | null;
	readonly authMethod: string | null;
	readonly recommendedEnvVars: readonly string[];
	readonly baseUrls: readonly string[];
	readonly importantNotes: readonly string[];
}

export interface Provider {
	readonly id: string;
	readonly name: string;
	readonly baseUrl: string;
	readonly apiKey: string;
	readonly capabilities?: string;
	/** Provider dashboard page where API keys are created. */
	readonly apiKeyUrl?: string;
	readonly iconDarkUrl?: string;
	readonly iconLightUrl?: string;
	readonly apiConfiguration?: ProviderApiConfiguration;
}

export type PublicProvider = Omit<Provider, 'apiKey'>;
export type ProviderInput = Provider;

/** A model service in resources/providers/<id>/manifest.json. */
export interface CatalogEntryModel extends ProviderModel {
	readonly type: ModelCapability;
	/** Base URL of the API serving this model. */
	readonly url: string;
	/** Preferred provider for this model's capability when nothing is configured. */
	readonly default?: boolean;
	/** Realtime audio input sample rate. */
	readonly sampleRate?: number;
	/** Provider-documented, model-specific input controls. */
	readonly metadata?: ModelMetadata;
}

export type ProviderServiceType =
	| 'large-language-model'
	| 'research-chat-model'
	| 'speech-to-text-model'
	| 'text-to-speech-model'
	| 'realtime-voice-model'
	| 'text-to-image-model'
	| 'text-to-video-model'
	| 'text-to-audio-model'
	| 'embedding-model'
	| 'web-search'
	| 'database'
	| 'mcp'
	| 'bot';

/** A service as represented in a provider manifest. */
export interface ProviderManifestService extends Omit<CatalogEntryModel, 'type'> {
	readonly type: ProviderServiceType;
}

/** A non-model service in resources/providers/<id>/manifest.json. */
export interface CatalogEntryService {
	readonly id: string;
	readonly name: string;
	readonly type: string;
	/** Base URL of the API serving this service. */
	readonly url?: string;
	/** Provider-documented, service-specific input controls. */
	readonly metadata?: ModelMetadata;
}

/** A non-model provider service, carrying the provider that serves it. */
export interface CatalogService extends CatalogEntryService {
	readonly provider: PublicProvider;
}

/** One web search service in resources/providers/<id>/manifest.json. */
export interface CatalogEntryWebSearch extends CatalogEntryService {
	readonly type: 'web-search';
	readonly url: string;
}

/** A web search offering, carrying the provider that serves it. */
export interface CatalogWebSearch extends CatalogEntryWebSearch {
	readonly provider: PublicProvider;
}

/** Provider definition stored in resources/providers/<id>/manifest.json. */
export interface ProviderManifest {
	readonly providerId: string;
	readonly providerName: string;
	/** Provider dashboard page where API keys are created. */
	readonly apiKeyUrl?: string;
	/** Human-readable steps for obtaining credentials. */
	readonly instructions?: string;
	readonly images_url?: string;
	readonly icon_dark_url?: string;
	readonly icon_light_url?: string;
	readonly services: readonly ProviderManifestService[];
}

export interface ModelSelection {
	provider: PublicProvider;
	model: ProviderModel;
}

/** Which settings-store collection a provider credential belongs to. */
export type StoredProviderKind = 'models' | 'databases' | 'channels';

export type ProviderCredentialKind = Exclude<StoredProviderKind, 'channels'> | 'search_engines';

export type ProviderSyncStatus = 'local' | 'pending' | 'synced' | 'memoryOnly';

export interface ProviderCredentialSaveInput {
	kind: Exclude<ProviderCredentialKind, 'search_engines'>;
	id: string;
	apiKey: string;
}

export interface ProviderCredentialSummary {
	kind: ProviderCredentialKind;
	id: string;
	name: string;
	baseUrl: string;
	configured: boolean;
	syncStatus: ProviderSyncStatus;
}

export interface ProviderVaultStatus {
	persistence: 'encrypted' | 'memory';
	cloudConfigured: boolean;
	unlocked: boolean;
	pending: number;
	lastSyncedAt?: string;
	warning?: string;
}

/** A provider's credentials as saved by the user. */
export interface StoredProvider {
	id: string;
	name: string;
	apiKey: string;
	baseUrl: string;
}

export interface ResolvedProvider {
	id: string;
	apiKey: string;
	baseURL: string;
}

export function normalizeProviderId(providerId: string): string {
	return providerId.trim().toLowerCase();
}

export function getProviderApiConfigurationUrl(
	provider: Pick<Provider, 'apiKeyUrl' | 'apiConfiguration' | 'baseUrl'>
): string {
	return (
		provider.apiKeyUrl?.trim() ||
		provider.apiConfiguration?.apiKeyManagementUrl?.trim() ||
		provider.apiConfiguration?.configurationDocsUrl?.trim() ||
		provider.baseUrl.trim()
	);
}

function providerCapabilityTokens(provider: Pick<Provider, 'capabilities'>): string[] {
	return (provider.capabilities ?? '')
		.split(/\s+-\s+/)
		.map((capability) => capability.trim().toLowerCase())
		.filter(Boolean);
}

export function providerHasCapability(
	provider: Pick<Provider, 'capabilities'>,
	capability: string
): boolean {
	return providerCapabilityTokens(provider).includes(capability.trim().toLowerCase());
}

export function providerHasImageCapability(provider: Pick<Provider, 'capabilities'>): boolean {
	return providerHasCapability(provider, 'Image');
}
