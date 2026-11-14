import { CORE_PLUGIN_ID } from '../../shared/plugin_types';
import { pluginsStore } from './plugins_store';

export function setPluginEnabled(id: string, enabled: boolean): void {
	if (id === CORE_PLUGIN_ID) throw new Error('The core plugin cannot be disabled.');
	const disabled = new Set(pluginsStore.get('disabled'));
	const allowed = new Set(pluginsStore.get('enabled'));
	if (enabled) {
		disabled.delete(id);
		allowed.add(id);
	} else {
		disabled.add(id);
		allowed.delete(id);
	}
	pluginsStore.set('disabled', [...disabled]);
	pluginsStore.set('enabled', [...allowed]);
}
