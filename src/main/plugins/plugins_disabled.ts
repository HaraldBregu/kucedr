import { CORE_PLUGIN_ID } from '../../shared/plugin_types';
import { pluginsStore } from './plugins_store';
import { scanPlugins } from './plugins_scan';

export function disabledPlugins(): Set<string> {
	const disabled = new Set(pluginsStore.get('disabled'));
	const enabled = new Set(pluginsStore.get('enabled'));
	return new Set(
		scanPlugins()
			.filter(({ id, builtIn }) =>
				builtIn ? id !== CORE_PLUGIN_ID && disabled.has(id) : !enabled.has(id)
			)
			.map(({ id }) => id)
	);
}
