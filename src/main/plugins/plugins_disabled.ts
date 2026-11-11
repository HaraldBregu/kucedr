import { CORE_PLUGIN_ID } from '../../shared/plugin_types';
import { pluginsStore } from './plugins_store';

export function disabledPlugins(): Set<string> {
	return new Set(pluginsStore.get('disabled').filter((id) => id !== CORE_PLUGIN_ID));
}
