import { CORE_PLUGIN_ID } from '../../shared/plugin_types';
import { pluginsStore } from './plugins_store';

export function setPluginEnabled(id: string, enabled: boolean): void {
	if (id === CORE_PLUGIN_ID) throw new Error('The core plugin cannot be disabled.');
	const disabled = new Set(pluginsStore.get('disabled'));
	if (enabled) disabled.delete(id);
	else disabled.add(id);
	pluginsStore.set('disabled', [...disabled]);
}
