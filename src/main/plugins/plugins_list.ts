import path from 'node:path';
import {
	CORE_PLUGIN_ID,
	PLUGIN_KINDS,
	type PluginInfo,
	type PluginKind,
} from '../../shared/plugin_types';
import { pluginIcon } from './plugins_icon';
import { scanPlugins } from './plugins_scan';
import { pluginsStore } from './plugins_store';
import type { ProviderManifestSetting } from '../../shared/provider_types';

export function listPlugins(): PluginInfo[] {
	const disabled = new Set(pluginsStore.get('disabled'));
	return scanPlugins().map(({ id, directory, builtIn, manifest, error }) => ({
		id,
		name: manifest?.title ?? id,
		...(manifest && {
			version: manifest.version,
			description: manifest.description,
			...(manifest.author && { author: manifest.author }),
			...(manifest.icon && { icon: pluginIcon(path.join(directory, 'assets', manifest.icon)) }),
			...(manifest.iconDark && {
				iconDark: pluginIcon(path.join(directory, 'assets', manifest.iconDark)),
			}),
		}),
		categories: manifest?.categories ?? [],
		builtIn,
		core: builtIn && id === CORE_PLUGIN_ID,
		enabled: !disabled.has(id),
		...(error && { error }),
		contributes:
			manifest?.contributes ??
			(Object.fromEntries(PLUGIN_KINDS.map((kind) => [kind, [] as string[]])) as Record<
				PluginKind,
				string[]
			>),
		extensions:
			manifest?.extensions.map(({ icon, ...extension }) => ({
				...extension,
				...(icon && { icon: pluginIcon(path.join(directory, 'extensions', extension.id, icon)) }),
			})) ?? [],
		settings: (manifest?.settings as ProviderManifestSetting[] | undefined) ?? [],
	}));
}
