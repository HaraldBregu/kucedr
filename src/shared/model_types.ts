import type { AuthenticationType, PublicProvider } from './provider_types';

export type SpeechToTextApiType = 'batch' | 'stream';

export type ModelCapability =
	| 'llm'
	| 'research-chat'
	| 'speech-to-text'
	| 'text-to-speech'
	| 'realtime-voice'
	| 'text-to-image'
	| 'text-to-video'
	| 'text-to-audio'
	| 'embedding';

export interface ModelInputChoice {
	readonly const: string | number;
	readonly title?: string;
}

export interface ModelInputSchema {
	readonly type?: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
	readonly title?: string;
	readonly description?: string;
	readonly enum?: readonly (string | number)[];
	readonly oneOf?: readonly ModelInputChoice[];
	readonly minimum?: number;
	readonly maximum?: number;
	readonly default?: string | number | boolean;
	readonly properties?: Readonly<Record<string, ModelInputSchema>>;
	readonly items?: ModelInputSchema;
	readonly required?: boolean;
}

export interface PromptAttachmentRule {
	readonly kind: 'image' | 'document' | 'audio' | 'video';
	readonly mimeTypes: readonly string[];
	readonly extensions: readonly string[];
	readonly maxFiles?: number;
	readonly maxBytes?: number;
	readonly maxTotalBytes?: number;
}

export interface ModelMetadata {
	/** Official provider page that documents this service's request contract. */
	readonly documentationUrl: string;
	/** Whether the catalog model has an externally documented request contract. */
	readonly documentationStatus?: 'verified' | 'unverified';
	/** Provider-documented total input plus output context window. */
	readonly contextWindow?: number;
	/** Provider-recommended output limit when the user has not configured one. */
	readonly defaultOutputTokens?: number;
	/** Native prompt attachments accepted by this exact model. */
	readonly promptAttachments?: readonly PromptAttachmentRule[];
	/** API request fields supported by this exact service or model. */
	readonly inputs: Readonly<Record<string, ModelInputSchema>>;
}

export interface ProviderModel {
	readonly id: string;
	readonly name: string;
	/** Speech-to-text only: transcription APIs this model supports. */
	readonly apiTypes?: readonly SpeechToTextApiType[];
	/** Speech-to-text only: model streams transcripts in realtime. */
	readonly realtime?: boolean;
	/** Provider-documented, model-specific input controls. */
	readonly metadata?: ModelMetadata;
}

export type ModelCatalog = Readonly<Record<string, readonly ProviderModel[]>>;

/** A model flattened together with the provider that serves it. */
export interface CatalogModel extends ProviderModel {
	readonly type: ModelCapability;
	readonly authentication?: AuthenticationType;
	/** Base URL of the API serving this model. */
	readonly url?: string;
	readonly provider: PublicProvider;
	/** Realtime audio input sample rate, from the provider entry. */
	readonly sampleRate?: number;
	/** The provider is the default choice for this capability. */
	readonly default?: boolean;
}

export function cloneModels(models: readonly ProviderModel[] | undefined): ProviderModel[] {
	return (models ?? []).map((model) => ({ ...model }));
}
