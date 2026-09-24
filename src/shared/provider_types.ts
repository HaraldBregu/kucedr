import type { ModelCapability, ModelMetadata, ProviderModel } from './model_types';

export type AuthenticationType = 'api-key' | 'oauth2' | 'none';
export type StorageAuthenticationType = 's3-access-key';
export type ModelLocation = 'remote' | 'local';
export type DatabaseType = 'vector' | 'sql' | 'nosql';

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
	readonly authentication?: AuthenticationType;
	readonly iconDarkUrl?: string;
	readonly iconLightUrl?: string;
	readonly apiConfiguration?: ProviderApiConfiguration;
}

export type PublicProvider = Omit<Provider, 'apiKey'>;
export type ProviderInput = Provider;

/** A model in resources/providers/<id>/manifest.json. */
export interface CatalogEntryModel extends ProviderModel {
	readonly type: ModelCapability;
	readonly location: ModelLocation;
	readonly authentication?: AuthenticationType;
	/** Base URL of the API serving this model. */
	readonly url: string;
	/** Preferred provider for this model's capability when nothing is configured. */
	readonly default?: boolean;
	/** Realtime audio input sample rate. */
	readonly sampleRate?: number;
	/** Provider-documented, model-specific input controls. */
	readonly metadata?: ModelMetadata;
}

export type ProviderModelType =
	| 'large-language-model'
	| 'research-chat-model'
	| 'speech-to-text-model'
	| 'text-to-speech-model'
	| 'realtime-voice-model'
	| 'text-to-image-model'
	| 'text-to-video-model'
	| 'text-to-audio-model'
	| 'embedding-model';

export interface ProviderManifestModel extends Omit<CatalogEntryModel, 'type'> {
	readonly type: ProviderModelType;
	readonly icon_dark_url?: string;
	readonly icon_light_url?: string;
}

export interface ProviderManifestMcpServer {
	readonly id: string;
	readonly name: string;
	readonly description?: string;
	readonly url: string;
	readonly authentication: AuthenticationType;
	readonly icon_dark_url?: string;
	readonly icon_light_url?: string;
}

export interface ProviderManifestDatabase {
	readonly id: string;
	readonly name: string;
	readonly type: DatabaseType;
	readonly url: string;
	readonly authentication: AuthenticationType;
}

export interface ProviderManifestStorage {
	readonly id: string;
	readonly name: string;
	readonly authentication: StorageAuthenticationType;
	readonly metadata: {
		readonly protocol: 's3';
		readonly region?: string;
		readonly endpointTemplate?: string;
		readonly forcePathStyle?: boolean;
	};
}

export interface ProviderManifestWebSearch {
	readonly id: string;
	readonly name: string;
	readonly url: string;
	readonly authentication: AuthenticationType;
}

export interface ProviderManifestBot {
	readonly id: string;
	readonly name: string;
	readonly url: string;
}

/** A non-model service in resources/providers/<id>/manifest.json. */
export interface CatalogEntryService {
	readonly id: string;
	readonly name: string;
	readonly description?: string;
	readonly type: string;
	readonly authentication?: AuthenticationType;
	/** Base URL of the API serving this service. */
	readonly url?: string;
	/** Provider-documented, service-specific input controls. */
	readonly metadata?: ModelMetadata;
}

/** A non-model provider service, carrying the provider that serves it. */
export interface CatalogService extends CatalogEntryService {
	readonly provider: PublicProvider;
	readonly iconDarkUrl?: string;
	readonly iconLightUrl?: string;
}

export interface CatalogStorage extends ProviderManifestStorage {
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
	readonly authentication?: AuthenticationType;
	/** Provider dashboard page where API keys are created. */
	readonly apiKeyUrl?: string;
	/** Human-readable steps for obtaining credentials. */
	readonly instructions?: string;
	readonly images_url?: string;
	readonly icon_dark_url?: string;
	readonly icon_light_url?: string;
	readonly models?: readonly ProviderManifestModel[];
	readonly mcp_servers?: readonly ProviderManifestMcpServer[];
	readonly databases?: readonly ProviderManifestDatabase[];
	readonly storage?: ProviderManifestStorage;
	readonly web_search?: readonly ProviderManifestWebSearch[];
	readonly bots?: readonly ProviderManifestBot[];
}

export interface ModelSelection {
	provider: PublicProvider;
	model: ProviderModel;
}

/** Which settings-store collection a provider credential belongs to. */
export type StoredProviderKind = 'models' | 'databases' | 'channels';

export type ProviderCredentialKind = Exclude<StoredProviderKind, 'channels'> | 'search_engines';

export interface ProviderCredentialSaveInput {
	kind: Exclude<ProviderCredentialKind, 'search_engines'>;
	id: string;
	apiKey: string;
	baseUrl?: string;
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
