import path from 'node:path';
import Store from 'electron-store';
import { userDataLocation } from '../../shared/user_data_location';
import { DEFAULT_HEALTH_SETTINGS, type HealthSettings } from './health_types';

const HEALTH_STORE_NAME = 'health';
const settingsDirectory = path.resolve(userDataLocation(), 'settings');

const store = new Store<HealthSettings>({
	name: HEALTH_STORE_NAME,
	cwd: settingsDirectory,
	accessPropertiesByDotNotation: false,
	defaults: DEFAULT_HEALTH_SETTINGS,
});

export const healthStorePath = store.path;

export function getHealthSettings(): HealthSettings {
	return { ...DEFAULT_HEALTH_SETTINGS, ...store.store, modelOptions: store.store.modelOptions ?? {} };
}

export function updateHealthSettings(patch: Partial<HealthSettings>): HealthSettings {
	const next = { ...getHealthSettings(), ...patch };
	store.store = next;
	return next;
}

export function resetHealthSettings(): HealthSettings {
	store.store = DEFAULT_HEALTH_SETTINGS;
	return getHealthSettings();
}
