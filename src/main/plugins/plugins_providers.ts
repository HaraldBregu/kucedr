import type { PluginSource } from '../../shared/plugin_types';
import type { ProviderManifest } from '../../shared/provider_types';
import { scanPlugins } from './plugins_scan';
import { pluginsStore } from './plugins_store';

export interface PluginProvider {
	/** The plugin folder; the provider's `/assets/...` icon paths resolve against it. */
	readonly directory: string;
	readonly manifest: ProviderManifest;
	readonly plugin: PluginSource;
}

export function pluginProviders(): PluginProvider[] {
	const disabled = new Set(pluginsStore.get('disabled'));
	return scanPlugins().flatMap(({ id, directory, manifest }) =>
		manifest?.provider && !disabled.has(id)
			? [{ directory, manifest: manifest.provider, plugin: { id, name: manifest.title } }]
			: []
	);
}
