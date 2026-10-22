import { pluginsStore } from './plugins_store';

export function savePluginSettings(id: string, values: Record<string, string>): void {
	const trimmed = Object.fromEntries(
		Object.entries(values)
			.map(([key, value]) => [key, value.trim()])
			.filter(([, value]) => value)
	);
	pluginsStore.set('settings', { ...pluginsStore.get('settings'), [id]: trimmed });
}
