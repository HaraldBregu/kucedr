import path from 'node:path';
import Store from 'electron-store';
import type {
	ResolvedProvider,
	StoredProvider,
	StoredProviderKind,
} from '../shared/provider_types';
import type { StorageSyncSettings } from '../shared/storage_types';
import { userDataLocation } from './shared/user_data_location';
import { DEFAULT_SYNC_CRON_EXPRESSION } from './storage/storage_sync_types';
import { normalizeStorageSettings } from './storage/storage_config';
import { storageProviders } from './storage/providers';
import { migrateMcpStoreFromProviders } from './mcp/mcp_store_state';
import type { PersistedTaskState } from './tasks/tasks_types';
import type { AppLanguage, AppLaunchState, AppTheme } from '../shared/app_types';
import {
	getModelProvidersState,
	setModelProvidersState,
	getDatabaseProvidersState,
	setDatabaseProvidersState,
} from './providers/providers_index';
import { getRagConfiguration, saveRagConfiguration } from './agent/knowledge/rag/rag_store';

export type AppSettingsState = {
	trayEnabled: boolean;
	keepAwake: boolean;
	language: AppLanguage;
	theme: AppTheme;
	microphoneInputId: string;
	launchCount: number;
	cloud: StorageSyncSettings;
};

const APP_SETTINGS_STORE_NAME = 'app';

const DEFAULT_STORAGE_SETTINGS: StorageSyncSettings = {
	paths: [],
	syncEnabled: false,
	syncCronExpression: DEFAULT_SYNC_CRON_EXPRESSION,
};

const DEFAULT_TASK_CONFIGURATION: PersistedTaskState = { schedules: [] };

const DEFAULT_APP_SETTINGS: AppSettingsState = {
	trayEnabled: true,
	keepAwake: false,
	language: 'en',
	theme: 'system',
	microphoneInputId: 'default',
	launchCount: 0,
	cloud: DEFAULT_STORAGE_SETTINGS,
};

const settingsDirectory = path.resolve(userDataLocation(), 'settings');

const store = new Store<AppSettingsState>({
	name: APP_SETTINGS_STORE_NAME,
	cwd: settingsDirectory,
	accessPropertiesByDotNotation: false,
	defaults: DEFAULT_APP_SETTINGS,
});

type LegacyAppSettingsState = AppSettingsState & {
	databaseConfiguration?: { providerId?: string; databaseId?: string };
	modelSelections?: {
		embedding?: { providerId: string; modelId: string };
	};
};

const persistedSettings = { ...store.store } as LegacyAppSettingsState;
const legacyDatabase = persistedSettings.databaseConfiguration;
const legacyEmbedding = persistedSettings.modelSelections?.embedding;
if (legacyDatabase || legacyEmbedding) {
	const configuration = getRagConfiguration();
	const hasRagDatabase = Boolean(configuration.databaseProviderId && configuration.databaseId);
	const hasLegacyDatabase = Boolean(legacyDatabase?.providerId && legacyDatabase.databaseId);
	const hasRagEmbedding = Boolean(
		configuration.embeddingProviderId && configuration.embeddingModelId
	);
	const hasLegacyEmbedding = Boolean(legacyEmbedding?.providerId && legacyEmbedding.modelId);
	saveRagConfiguration({
		...configuration,
		databaseProviderId: hasRagDatabase
			? configuration.databaseProviderId
			: hasLegacyDatabase
				? legacyDatabase?.providerId?.trim() || ''
				: '',
		databaseId: hasRagDatabase
			? configuration.databaseId
			: hasLegacyDatabase
				? legacyDatabase?.databaseId?.trim() || ''
				: '',
		embeddingProviderId: hasRagEmbedding
			? configuration.embeddingProviderId
			: hasLegacyEmbedding
				? legacyEmbedding?.providerId?.trim() || ''
				: '',
		embeddingModelId: hasRagEmbedding
			? configuration.embeddingModelId
			: hasLegacyEmbedding
				? legacyEmbedding?.modelId?.trim() || ''
				: '',
	});
}
migrateMcpStoreFromProviders();
delete persistedSettings.databaseConfiguration;
delete persistedSettings.modelSelections;
store.store = {
	...DEFAULT_APP_SETTINGS,
	...persistedSettings,
};

export const appSettingsStorePath = store.path;

const taskConfigurationStore = new Store<PersistedTaskState>({
	name: 'tasks',
	cwd: settingsDirectory,
	accessPropertiesByDotNotation: false,
	defaults: DEFAULT_TASK_CONFIGURATION,
});

export const taskConfigurationStorePath = taskConfigurationStore.path;

export function getTrayEnabled(): boolean {
	return store.get('trayEnabled');
}

export function setTrayEnabled(enabled: boolean): void {
	store.set('trayEnabled', enabled);
}

export function getKeepAwake(): boolean {
	return store.get('keepAwake');
}

export function setKeepAwake(enabled: boolean): void {
	store.set('keepAwake', enabled);
}

export function getLanguage(): AppLanguage {
	return store.get('language');
}

export function setLanguage(language: AppLanguage): void {
	store.set('language', language);
}

export function getTheme(): AppTheme {
	return store.get('theme');
}

export function setTheme(theme: AppTheme): void {
	store.set('theme', theme);
}

export function getMicrophoneInputId(): string {
	return store.get('microphoneInputId');
}

export function setMicrophoneInputId(inputId: string): void {
	if (typeof inputId !== 'string' || !inputId.trim()) {
		throw new Error('Invalid microphone input ID.');
	}
	store.set('microphoneInputId', inputId);
}

export function recordAppLaunch(): AppLaunchState {
	const launchCount = store.get('launchCount') + 1;
	store.set('launchCount', launchCount);
	return { launchCount, isFirstLaunch: launchCount === 1 };
}

export function getLaunchState(): AppLaunchState {
	const launchCount = store.get('launchCount');
	return { launchCount, isFirstLaunch: launchCount === 1 };
}

function readProviders(kind: StoredProviderKind): StoredProvider[] {
	if (kind === 'models') return getModelProvidersState();
	if (kind === 'databases') return getDatabaseProvidersState();
	if (kind === 'channels') return [];
	return [];
}

export function listProviders(kind?: StoredProviderKind): StoredProvider[] {
	return kind ? readProviders(kind) : [...readProviders('models'), ...readProviders('databases')];
}

export function getProvider(
	id: string,
	kind: Exclude<StoredProviderKind, 'channels'> = 'models'
): StoredProvider | undefined {
	return readProviders(kind).find((provider) => provider.id === id);
}

export function hasProvider(
	id: string,
	kind: Exclude<StoredProviderKind, 'channels'> = 'models'
): boolean {
	return getProvider(id, kind) !== undefined;
}

export function setProvider(
	provider: StoredProvider,
	kind: StoredProviderKind = 'models'
): StoredProvider {
	if (kind === 'channels') {
		throw new Error('Channel providers are stored in channels settings.');
	}
	const providers = readProviders(kind);
	const index = providers.findIndex((entry) => entry.id === provider.id);
	if (index === -1) providers.push(provider);
	else providers[index] = provider;
	if (kind === 'databases') {
		setDatabaseProvidersState(providers);
	} else {
		setModelProvidersState(providers);
	}
	return provider;
}

export function deleteProvider(
	id: string,
	kind: Exclude<StoredProviderKind, 'channels'> = 'models'
): void {
	const remaining = readProviders(kind).filter((provider) => provider.id !== id);
	if (kind === 'databases') setDatabaseProvidersState(remaining);
	else setModelProvidersState(remaining);
}

export function clearProviders(): void {
	setModelProvidersState([]);
	setDatabaseProvidersState([]);
}

/** The selected provider resolved to the shape model adapters consume. */
export function getResolvedProvider(providerId: string | undefined): ResolvedProvider | undefined {
	if (!providerId) return undefined;
	const provider = getProvider(providerId, 'models');
	if (!provider) return undefined;
	return {
		id: providerId,
		apiKey: provider.apiKey,
		baseURL: provider.baseUrl,
	};
}

export function getStorageSettings(): StorageSyncSettings {
	return normalizeStorageSettings({
		...DEFAULT_STORAGE_SETTINGS,
		...store.get('cloud'),
	});
}

export function saveStorageSettings(settings: StorageSyncSettings): StorageSyncSettings {
	const saved = normalizeStorageSettings(settings);
	if (saved.providerId || saved.syncEnabled) storageProviders.resolve(saved.providerId);
	store.set('cloud', saved);
	return saved;
}

export function getTaskConfiguration(): PersistedTaskState {
	const configuration = taskConfigurationStore.store;
	// Fresh array so in-place mutations never touch the shared defaults object
	return { ...configuration, schedules: [...(configuration.schedules ?? [])] };
}

export function setTaskConfiguration(configuration: PersistedTaskState): void {
	taskConfigurationStore.store = configuration;
}
