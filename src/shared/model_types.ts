import type { AuthenticationType, ModelLocation, PublicProvider } from './provider_types';

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
	| 'embedding'
	| 'decision'
	| 'code-completion'
	| 'coding-agent';

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
	readonly maxItems?: number;
	/** Object input: setting one property clears its siblings. */
	readonly exclusive?: boolean;
	/** Surfaces where this input is not offered. */
	readonly hidden?: readonly ('settings' | 'tool')[];
	/** Generic UI role this input drives. */
	readonly role?: 'aspect-ratio' | 'voice';
}

export interface ModelEffort {
	/** Dotted request path the resolved effort is written to. */
	readonly path: string;
	readonly map?: Readonly<Record<string, string>>;
	/** Deep-merged into the request when an effort is applied. */
	readonly set?: Readonly<Record<string, unknown>>;
	/** Deep-merged whenever the request carries reasoning fields. */
	readonly setWhenPresent?: Readonly<Record<string, unknown>>;
	/** Dotted request paths deleted before the effort is written. */
	readonly unset?: readonly string[];
	/** Send an effort only when the model declares it; never a prompt-derived one. */
	readonly strict?: boolean;
}

export interface ModelHarness {
	readonly package: string;
	readonly binary: string;
	readonly homeEnv?: string;
	readonly clearEnv?: readonly string[];
	readonly instructionFiles: readonly string[];
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
	readonly description?: string;
	/** Official provider page that documents this service's request contract. */
	readonly documentationUrl: string;
	/** Whether the catalog model has an externally documented request contract. */
	readonly documentationStatus?: 'verified' | 'unverified';
	/** Provider-documented total input plus output context window. */
	readonly contextWindow?: number;
	readonly maxInputTokens?: number;
	readonly contextWindowDocumentationUrl?: string;
	/** Provider-recommended output limit when the user has not configured one. */
	readonly defaultOutputTokens?: number;
	readonly outputTokensField?: 'max_tokens' | 'max_completion_tokens';
	/** Native prompt attachments accepted by this exact model. */
	readonly promptAttachments?: readonly PromptAttachmentRule[];
	/** API request fields supported by this exact service or model. */
	readonly inputs: Readonly<Record<string, ModelInputSchema>>;
	readonly discoveryInputs?: Readonly<Record<string, ModelInputSchema>>;
	/** Wire protocol id that selects the adapter for this model. */
	readonly protocol?: string;
	readonly operations?: Readonly<Record<string, {
		readonly endpoint: string;
		readonly description: string;
		readonly inputSchema: Readonly<Record<string, unknown>>;
	}>>;
	/** WebSocket endpoint for socket protocols; `{key}` is filled from request options. */
	readonly socketUrl?: string;
	/** Request values merged under the user's options. */
	readonly requestDefaults?: Readonly<Record<string, unknown>>;
	readonly unsupportedOptions?: readonly string[];
	/** Stored provider base URLs this model accepts. */
	readonly baseUrlRule?: { readonly pattern: string; readonly example?: string };
	readonly effort?: ModelEffort;
	readonly cache?: ModelCache;
	readonly clampEffort?: boolean;
	readonly dsml?: boolean;
	readonly reasoningContent?: 'roundtrip';
	/** Chat: content-part type used for PDF attachments. */
	readonly documentPart?: string;
	/** Chat: replay assistant content chunks verbatim. */
	readonly contentChunks?: 'roundtrip';
	/** Chat: fold a text-only user message that follows a tool message into it. */
	readonly mergeUserAfterTool?: boolean;
	/** Submit path relative to url; `{model}` is the wire model id. */
	readonly endpoint?: string;
	/** Model id sent on the wire when it differs from the manifest id. */
	readonly apiModelId?: string;
	/** Wire name of the prompt field. */
	readonly promptField?: string;
	/** Instruction prefixes; `{text}` is replaced by the input text. */
	readonly inputTemplates?: { readonly query?: string; readonly document?: string };
	readonly harness?: ModelHarness;
	readonly families?: readonly ModelFamily[];
}

export interface ModelCache {
	readonly readTokens?: readonly string[];
	readonly writeTokens?: readonly string[];
	readonly sessionKey?: string;
	readonly breakpoints?: readonly 'system'[];
}

export interface ModelFamily {
	readonly match: string;
	readonly metadata: Partial<ModelMetadata>;
}

export interface ProviderModel {
	readonly discovered?: boolean;
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
	readonly location: ModelLocation;
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
