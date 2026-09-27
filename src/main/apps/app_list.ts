import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { isAppId } from './app_id';
import { readAppManifestFromDirectory } from './app_read';
import { appsRoot } from './app_root';
import { debugAppPaths } from './app_debug_paths';
import type { App } from './app_types';

export function listApps(appLocation?: string): App[] {
	const root = appsRoot(appLocation);
	const apps: App[] = [];
	const directories = existsSync(root)
		? readdirSync(root, { withFileTypes: true })
				.filter((entry) => entry.isDirectory() && isAppId(entry.name))
				.sort((left, right) => left.name.localeCompare(right.name))
		: [];
	for (const directory of directories) {
		const installedDirectory = path.join(root, directory.name);
		const manifest = readAppManifestFromDirectory(installedDirectory);
		if (!manifest) continue;
		const entry = path.join(installedDirectory, ...manifest.metadata.entry.split('/'));
		try {
			if (!statSync(entry).isFile()) continue;
		} catch {
			continue;
		}
		const image = manifest.metadata.image
			? path.join(appsRoot(appLocation), directory.name, ...manifest.metadata.image.split('/'))
			: undefined;
		const imageUrl =
			image && existsSync(image) && statSync(image).isFile()
				? `kucedr-app://${directory.name}/${manifest.metadata.image}`
				: undefined;
		apps.push({ id: directory.name, ...manifest, ...(imageUrl && { imageUrl }) });
	}
	if (appLocation === undefined) {
		for (const directory of debugAppPaths()) {
			const id = path.basename(directory);
			if (!isAppId(id) || apps.some((app) => app.id === id)) continue;
			const manifest = readAppManifestFromDirectory(directory);
			if (!manifest) continue;
			const entry = path.join(directory, ...manifest.metadata.entry.split('/'));
			try {
				if (!statSync(entry).isFile()) continue;
			} catch {
				continue;
			}
			const image = manifest.metadata.image
				? path.join(directory, ...manifest.metadata.image.split('/'))
				: undefined;
			const imageUrl =
				image && existsSync(image) && statSync(image).isFile()
					? `kucedr-app://${id}/${manifest.metadata.image}`
					: undefined;
			apps.push({ id, ...manifest, debugPath: directory, ...(imageUrl && { imageUrl }) });
		}
	}
	return apps.sort((left, right) => left.id.localeCompare(right.id));
}
