import type { ModelCapability, ModelMetadata, ProviderModel } from './model_types';
import type { PluginSource } from './plugin_types';

export type AuthenticationType = 'api-key' | 'oauth2' | 'none';
export type StorageAuthenticationType = 's3-access-key';
export type ModelLocation = 'remote' | 'local';

export type PluginProviderKind = 'database' | 'storage';

export interface EnabledPluginProviders {
	readonly database: readonly string[];
	readonly storage: readonly string[];
}

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
	/** Endpoint listing the provider's models live, OpenAI `/models` shape. */
	readonly modelsUrl?: string;
	/** Model page template; `{id}` is replaced with the model id. */
	readonly modelUrl?: string;
	readonly authentication?: AuthenticationType;
	readonly iconDarkUrl?: string;
	readonly iconLightUrl?: string;
	/** Icon artwork fills the avatar with no inner padding. */
	readonly iconFullBleed?: boolean;
	/** Display rank in provider lists; lower first. */
	readonly order?: number;
	readonly website?: string;
	readonly apiConfiguration?: ProviderApiConfiguration;
}

export type PublicProvider = Omit<Provider, 'apiKey'> & {
	/** Set when an installed plugin contributes this provider. */
	readonly plugin?: PluginSource;
	readonly settings?: readonly ProviderManifestSetting[];
	readonly discoveryInputs?: ModelMetadata['discoveryInputs'];
	readonly discoveryLabel?: string;
	readonly discoveryMetadata?: ModelMetadata;
};

/** A plugin-wide value the user sets once, e.g. an OAuth client shared by all its services. */
export interface ProviderManifestSetting {
	readonly key: string;
	readonly label: string;
	readonly type: 'text' | 'password';
	readonly required: boolean;
}
export type ProviderInput = Provider;

/** A model in resources/plugins/<id>/manifest.json. */
export interface CatalogEntryModel extends ProviderModel {
	readonly type: ModelCapability;
	readonly location: ModelLocation;
	readonly authentication?: AuthenticationType;
	/** Base URL of the API serving this model. */
	readonly url?: string;
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
	| 'embedding-model'
	| 'coding-agent-model';

export interface ProviderManifestModel extends Omit<CatalogEntryModel, 'type'> {
	readonly type: ProviderModelType;
	readonly discoveryOnly?: boolean;
	readonly icon_dark_url?: string;
	readonly icon_light_url?: string;
}

export interface ProviderManifestMcpServer {
	readonly id: string;
	readonly name: string;
	readonly description?: string;
	readonly url: string;
	readonly authentication: AuthenticationType;
	readonly scopes: readonly string[];
	readonly oauth?: {
		readonly client_id_setting?: string;
		readonly client_secret_setting?: string;
		readonly authorization_params?: Readonly<Record<string, string>>;
		readonly google_fetch?: boolean;
		readonly credentials_required?: boolean;
	};
	readonly icon_dark_url?: string;
	readonly icon_light_url?: string;
}

export interface ProviderManifestVectorDatabase {
	readonly id: string;
	readonly name: string;
	readonly description?: string;
	readonly url: string;
	readonly authentication: AuthenticationType;
}

export interface ProviderManifestStorage {
	readonly id: string;
	readonly name: string;
	readonly description?: string;
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

/** A non-model service in resources/plugins/<id>/manifest.json. */
export interface CatalogEntryService {
	readonly id: string;
	readonly name: string;
	readonly description?: string;
	readonly instructions?: string;
	readonly type: string;
	readonly authentication?: AuthenticationType;
	readonly scopes?: readonly string[];
	readonly oauth?: ProviderManifestMcpServer['oauth'];
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

/** One web search service in resources/plugins/<id>/manifest.json. */
export interface CatalogEntryWebSearch extends CatalogEntryService {
	readonly type: 'SEARCH_ENGINE';
	readonly url: string;
}

/** A web search offering, carrying the provider that serves it. */
export interface CatalogWebSearch extends CatalogEntryWebSearch {
	readonly provider: PublicProvider;
}

/** Provider definition stored in resources/plugins/<id>/manifest.json. */
export interface ProviderManifest {
	readonly providerId: string;
	readonly providerName: string;
	readonly authentication?: AuthenticationType;
	/** Provider dashboard page where API keys are created. */
	readonly apiKeyUrl?: string;
	/** Base URL of the provider API; defaults to the first service url. */
	readonly baseUrl?: string;
	/** Endpoint listing the provider's models live, OpenAI `/models` shape. */
	readonly modelsUrl?: string;
	/** Model page template; `{id}` is replaced with the model id. */
	readonly modelUrl?: string;
	/** Human-readable steps for obtaining credentials. */
	readonly instructions?: string;
	readonly images_url?: string;
	readonly icon_dark_url?: string;
	readonly icon_light_url?: string;
	readonly models?: readonly ProviderManifestModel[];
	readonly mcp_servers?: readonly ProviderManifestMcpServer[];
	readonly vector_databases?: readonly ProviderManifestVectorDatabase[];
	readonly storage?: ProviderManifestStorage;
	readonly web_search?: readonly ProviderManifestWebSearch[];
	readonly settings?: readonly ProviderManifestSetting[];
	readonly discoveryInputs?: ModelMetadata['discoveryInputs'];
	readonly discoveryLabel?: string;
	readonly iconFullBleed?: boolean;
	readonly order?: number;
}

export interface ModelSelection {
	provider: PublicProvider;
	model: ProviderModel;
}

/** Which settings-store collection a provider credential belongs to. */
export type StoredProviderKind = 'models' | 'databases';

export type ProviderCredentialKind = StoredProviderKind | 'search_engines';

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
	/** Display name from the provider manifest title. */
	name?: string;
	apiKey: string;
	baseURL: string;
	authentication?: AuthenticationType;
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
