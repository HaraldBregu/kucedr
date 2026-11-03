import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CatalogService } from '../../shared/provider_types';
import { scanPlugins } from '../plugins/plugins_scan';
import { pluginsStore } from '../plugins/plugins_store';
import { readPluginChannel, type PluginChannel } from './channel_manifest';

export function discoverChannels(): PluginChannel[] {
	const disabled = new Set(pluginsStore.get('disabled'));
	return scanPlugins().flatMap(({ id, directory, manifest }) => {
		if (!manifest || disabled.has(id)) return [];
		return manifest.contributes.channels.flatMap((name) => {
			try {
				return [
					readPluginChannel(path.join(directory, 'channels', name), {
						id,
						name: manifest.title,
						version: manifest.version,
					}),
				];
			} catch {
				return [];
			}
		});
	});
}

export function resolveChannel(id: string): PluginChannel | undefined {
	return discoverChannels().find((channel) => channel.id === id);
}

export function loadChannels(): readonly CatalogService[] {
	const plugins = new Map(scanPlugins().map((plugin) => [plugin.id, plugin]));
	return discoverChannels()
		.map((channel) => {
			const plugin = plugins.get(channel.plugin.id);
			const icon = (file: string | undefined) => {
				if (!plugin || !file) return undefined;
				const iconPath = path.join(plugin.directory, 'assets', file);
				return existsSync(iconPath)
					? `local-resource://file${pathToFileURL(iconPath).pathname}`
					: undefined;
			};
			const iconLightUrl = icon(plugin?.manifest?.icon);
			const iconDarkUrl = icon(plugin?.manifest?.iconDark ?? plugin?.manifest?.icon);
			return {
				id: channel.id,
				name: channel.name,
				type: 'channel',
				credentials: channel.credentials,
				...(channel.instructions && { instructions: channel.instructions }),
				provider: {
					id: channel.id,
					name: channel.name,
					baseUrl: '',
					...(iconLightUrl && { iconLightUrl }),
					...(iconDarkUrl && { iconDarkUrl }),
				},
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
