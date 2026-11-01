import { pluginsStore } from './plugins_store';
import { scanPlugins } from './plugins_scan';
import { safeStorage } from 'electron';
import { isSafeStorageAvailable } from '../shared/safe_storage';

export function savePluginSettings(id: string, values: Record<string, string>): void {
	const plugin = scanPlugins().find((entry) => entry.id === id)?.manifest;
	if (!plugin) throw new Error('Unknown plugin.');
	const schema = plugin.settings as { inputSchema?: { properties?: Record<string, { format?: string }> } } | undefined;
	const properties = schema?.inputSchema?.properties ?? {};
	const plain: Record<string, string> = {};
	const secrets: Record<string, string> = {};
	for (const [key, input] of Object.entries(values)) {
		const value = input.trim();
		if (!value) continue;
		if (properties[key]?.format === 'password') {
			if (!isSafeStorageAvailable()) throw new Error('Secure storage is unavailable.');
			secrets[key] = safeStorage.encryptString(value).toString('base64');
		} else plain[key] = value;
	}
	pluginsStore.set('settings', { ...pluginsStore.get('settings'), [id]: plain });
	pluginsStore.set('secrets', { ...pluginsStore.get('secrets'), [id]: secrets });
}
