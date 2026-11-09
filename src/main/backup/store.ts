import { existsSync, readFileSync } from 'node:fs';
import Store from 'electron-store';
import type { StorageSyncSettings } from '../../shared/storage_types';
import { restrictSettingsFile } from '../shared/restrict_settings_file';
import { storageLocation } from '../storage/local/paths';
import { normalizeStorageSettings } from './normalize';
import { pluginScripts } from '../plugins';
import { storageProviders } from '../storage/providers';
import { DEFAULT_SYNC_CRON_EXPRESSION } from './types';

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
		if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) {
			throw new Error('Invalid legacy storage settings.');
		}
		const migrated = normalizeStorageSettings({ ...defaults, ...(legacy as object) });
		store.store = migrated;
		restrictSettingsFile(store.path);
		const installed = normalizeStorageSettings(JSON.parse(readFileSync(store.path, 'utf8')));
		if (JSON.stringify(installed) !== JSON.stringify(migrated)) {
			throw new Error('Storage settings migration could not be verified.');
		}
	}
	getStorageSettings();
}

export function getStorageSettings(): StorageSyncSettings {
	return normalizeStorageSettings(store.store);
}

export function saveStorageSettings(settings: StorageSyncSettings): StorageSyncSettings {
	const saved = normalizeStorageSettings(settings);
	if (
		saved.serviceId &&
		!pluginScripts('STORAGE').some((script) => script.name === saved.serviceId)
	)
		throw new Error('The selected storage service was not found.');
	if (saved.providerId || saved.syncEnabled) storageProviders.resolve(saved.providerId);
	store.store = saved;
	restrictSettingsFile(store.path);
	return saved;
}
