import { existsSync } from 'node:fs';
import Store from 'electron-store';
import type { StorageSyncSettings } from '../../shared/storage_types';
import { restrictSettingsFile } from '../shared/restrict_settings_file';
import { storageLocation } from './local/paths';
import { storageProviders } from './providers';
import { normalizeStorageSettings } from './storage_config';
import { DEFAULT_SYNC_CRON_EXPRESSION } from './storage_sync_types';

const defaults: StorageSyncSettings = {
	paths: [],
	syncEnabled: false,
	syncCronExpression: DEFAULT_SYNC_CRON_EXPRESSION,
};

const store = new Store<StorageSyncSettings>({
	name: 'settings',
	cwd: storageLocation(),
	accessPropertiesByDotNotation: false,
	defaults,
	clearInvalidConfig: false,
});

export const storageSettingsStorePath = store.path;

export function migrateStorageSettings(legacy: unknown): void {
	if (legacy === undefined) return;
	if (!existsSync(store.path)) {
		const migrated = normalizeStorageSettings({ ...defaults, ...(legacy as object) });
		store.store = migrated;
		restrictSettingsFile(store.path);
		if (JSON.stringify(getStorageSettings()) !== JSON.stringify(migrated)) {
			throw new Error('Storage settings migration could not be verified.');
		}
	}
	getStorageSettings();
}

export function getStorageSettings(): StorageSyncSettings {
	return normalizeStorageSettings({ ...defaults, ...store.store });
}

export function saveStorageSettings(settings: StorageSyncSettings): StorageSyncSettings {
	const saved = normalizeStorageSettings(settings);
	if (saved.providerId || saved.syncEnabled) storageProviders.resolve(saved.providerId);
	store.store = saved;
	restrictSettingsFile(store.path);
	return saved;
}
