import { existsSync, lstatSync, statSync } from 'node:fs';
import path from 'node:path';
import { isAppId } from './app_id';
import { appsRoot } from './app_root';
import { readAppManifestFromDirectory } from './app_read';
import { debugAppsStore } from './app_debug_store';
import { debugAppPaths } from './app_debug_paths';
import type { App } from './app_types';

export function addDebugApp(folderPath: string): App {
	const directory = path.resolve(folderPath.trim());
	const id = path.basename(directory);
	if (!folderPath.trim() || !path.isAbsolute(folderPath.trim())) {
		throw new Error('Enter an absolute app folder path.');
	}
	if (!isAppId(id)) throw new Error('Invalid app folder name.');
	if (
		!existsSync(directory) ||
		lstatSync(directory).isSymbolicLink() ||
		!statSync(directory).isDirectory()
	) {
		throw new Error('App folder does not exist or is not a directory.');
	}
	const manifest = readAppManifestFromDirectory(directory);
	if (!manifest) {
		throw new Error('Missing or invalid manifest. Expected manifest.json or package.json.');
	}
	const entry = path.join(directory, ...manifest.metadata.entry.split('/'));
	if (!existsSync(entry) || !statSync(entry).isFile()) throw new Error('App entry file is missing.');
	if (existsSync(path.join(appsRoot(), id))) {
		throw new Error(`An installed app already uses the ID “${id}”.`);
	}
	const paths = debugAppPaths();
	const existing = paths.find((value) => path.basename(value) === id);
	if (existing && existing !== directory) {
		throw new Error(`Another debug folder already uses the ID “${id}”.`);
	}
	if (!paths.includes(directory)) debugAppsStore.set('paths', [...paths, directory]);
	return { id, ...manifest, debugPath: directory };
}
