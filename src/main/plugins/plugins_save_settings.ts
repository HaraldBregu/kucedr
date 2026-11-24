import { pluginsStore } from './plugins_store';
import { scanPlugins } from './plugins_scan';
import { safeStorage } from 'electron';
import { isSafeStorageAvailable } from '../shared/safe_storage';

export function savePluginSettings(id: string, values: Record<string, string | null>): void {
	const plugin = scanPlugins().find((entry) => entry.id === id)?.manifest;
	if (!plugin) throw new Error('Unknown plugin.');
	const properties = plugin.settings?.inputSchema.properties ?? {};
	const settings = pluginsStore.get('settings');
	const storedSecrets = pluginsStore.get('secrets');
	const plain = { ...settings[id] };
	const secrets = { ...storedSecrets?.[id] };
	for (const [key, input] of Object.entries(values)) {
		if (!Object.hasOwn(properties, key)) throw new Error('Unknown plugin setting.');
		const secret = properties[key]?.format === 'password' || Object.hasOwn(secrets, key);
		delete plain[key];
		delete secrets[key];
		const value = input?.trim();
		if (!value) continue;
		if (secret) {
			if (!isSafeStorageAvailable()) throw new Error('Secure storage is unavailable.');
			Object.defineProperty(secrets, key, {
				value: safeStorage.encryptString(value).toString('base64'), enumerable: true,
			});
		} else Object.defineProperty(plain, key, { value, enumerable: true });
	}
	pluginsStore.set({ settings: { ...settings, [id]: plain }, secrets: { ...storedSecrets, [id]: secrets } });
}
