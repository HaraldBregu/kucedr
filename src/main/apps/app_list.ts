import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { appEntryPath } from './app_entry';
import { isAppId } from './app_id';
import { readAppManifest } from './app_read';
import { appsRoot } from './app_root';
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
		const manifest = readAppManifest(directory.name, appLocation);
		if (!manifest) continue;
		const entry = appEntryPath(directory.name, manifest.metadata.entry, appLocation);
		try {
			if (!statSync(entry).isFile()) continue;
		} catch {
			continue;
		}
		const icon = manifest.metadata.icon
			? path.join(appsRoot(appLocation), directory.name, ...manifest.metadata.icon.split('/'))
			: undefined;
		const iconUrl =
			icon && existsSync(icon) && statSync(icon).isFile()
				? `kucedr-app://${directory.name}/${manifest.metadata.icon}`
				: undefined;
		apps.push({ id: directory.name, ...manifest, ...(iconUrl && { iconUrl }) });
	}
	return apps.sort((left, right) => left.id.localeCompare(right.id));
}
