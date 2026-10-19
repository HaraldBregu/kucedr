import { pluginsStore } from './plugins_store';

export function setPluginEnabled(id: string, enabled: boolean): void {
	const disabled = new Set(pluginsStore.get('disabled'));
	if (enabled) disabled.delete(id);
	else disabled.add(id);
	pluginsStore.set('disabled', [...disabled]);
}
