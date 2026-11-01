import { pluginsStore } from './plugins_store';
import { safeStorage } from 'electron';
import { isSafeStorageAvailable } from '../shared/safe_storage';

export function pluginSettings(id: string): Record<string, string> {
	const values = { ...(pluginsStore.get('settings')[id] ?? {}) };
	const secrets = pluginsStore.get('secrets')?.[id] ?? {};
	if (Object.keys(secrets).length && !isSafeStorageAvailable()) throw new Error('Secure storage is unavailable.');
	for (const [key, value] of Object.entries(secrets)) {
		values[key] = safeStorage.decryptString(Buffer.from(value, 'base64'));
	}
	return values;
}
