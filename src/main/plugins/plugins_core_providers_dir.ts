import path from 'node:path';
import { CORE_PLUGIN_ID } from '../../shared/plugin_types';
import { bundledPluginsRoot } from './plugins_bundled_root';

/** The built-in providers, shipped inside the core plugin. */
export function coreProvidersDir(): string {
	return path.join(bundledPluginsRoot(), CORE_PLUGIN_ID, 'providers');
}
