import type { PublicProvider } from '../../../../shared';
import type { Model } from '@/lib/compat';

export type ProviderOption = {
	label: string;
	value: string;
};

export type ProviderSetupEntry = {
	providerId: string;
	apiKey: string;
	savedApiKey: string;
	apiKeySaved: boolean;
	editing: boolean;
};

export type ProviderCatalogItem = {
	id: string;
	name: string;
	capabilities: string;
	supported: boolean;
	apiConfigurationUrl?: string;
	iconDarkUrl?: string;
	iconLightUrl?: string;
};

export type ProviderModelGroup = {
	provider: PublicProvider;
	models: Model[];
};

export type ModelServiceId =
	| 'assistant'
	| 'health'
	| 'tasks'
	| 'voice'
	| 'transcription'
	| 'image'
	| 'video'
	| 'audio';

export type ModelServiceSelection = {
	providerId: string;
	modelId: string;
};

export type ModelServiceDefinition = {
	id: ModelServiceId;
	title: string;
	description: string;
	saveOnChange?: boolean;
	getSelection: () => Promise<ModelServiceSelection | undefined>;
	loadModelGroups: () => Promise<ProviderModelGroup[]>;
	saveSelection: (provider: PublicProvider, model: Model) => Promise<boolean>;
};

export type ModelServiceState = {
	providerId: string;
	modelId: string;
	modelGroups: ProviderModelGroup[];
};

export type ModelServiceStateMap = Record<ModelServiceId, ModelServiceState>;

export type SetupStep = 'modelProvider' | 'search' | 'models';

export type OnboardingStep = 'landing' | 'auth' | SetupStep;
