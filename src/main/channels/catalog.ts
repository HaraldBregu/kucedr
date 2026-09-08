import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
	normalizeProviderId,
	type CatalogService,
	type PublicProvider,
} from '../../shared/provider_types';
import { parseProviderManifest } from '../../shared/providers/validation';
import { isChannelId } from '../../shared/channels_definitions';
import { resourceRoot } from '../shared/resource_root';

export function loadChannels(): readonly CatalogService[] {
	const directory = path.join(resourceRoot(), 'resources/channels');
	if (!existsSync(directory)) return [];

	const channels: CatalogService[] = [];
	for (const dirent of readdirSync(directory, { withFileTypes: true })) {
		if (!dirent.isDirectory()) continue;
		try {
			const channelDirectory = path.join(directory, dirent.name);
			const manifestPath = path.join(channelDirectory, 'manifest.json');
			if (!existsSync(manifestPath)) continue;
			const manifest = parseProviderManifest(JSON.parse(readFileSync(manifestPath, 'utf-8')));
			if (!manifest || !isChannelId(normalizeProviderId(manifest.providerId))) continue;

			const darkIconPath = manifest.icon_dark_url
				? path.resolve(channelDirectory, manifest.icon_dark_url.replace(/^\/+/, ''))
				: undefined;
			const lightIconPath = manifest.icon_light_url
				? path.resolve(channelDirectory, manifest.icon_light_url.replace(/^\/+/, ''))
				: undefined;
			const iconDarkUrl =
				darkIconPath?.startsWith(`${channelDirectory}${path.sep}`) && existsSync(darkIconPath)
					? `local-resource://file${pathToFileURL(darkIconPath).pathname}`
					: undefined;
			const iconLightUrl =
				lightIconPath?.startsWith(`${channelDirectory}${path.sep}`) && existsSync(lightIconPath)
					? `local-resource://file${pathToFileURL(lightIconPath).pathname}`
					: undefined;
			const provider: PublicProvider = {
				id: normalizeProviderId(manifest.providerId),
				name: manifest.providerName,
				baseUrl: manifest.services.find((service) => service.url?.startsWith('http'))?.url ?? '',
				...(manifest.apiKeyUrl ? { apiKeyUrl: manifest.apiKeyUrl } : {}),
				...(iconDarkUrl ? { iconDarkUrl } : {}),
				...(iconLightUrl ? { iconLightUrl } : {}),
			};

			channels.push(
				...manifest.services
					.filter((service) => service.type === 'bot')
					.map((service) => ({ ...service, provider }))
			);
		} catch {
			continue;
		}
	}

	return channels.sort(
		(left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
	);
}
