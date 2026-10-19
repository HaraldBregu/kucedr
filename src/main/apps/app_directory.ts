import { existsSync } from 'node:fs';
import path from 'node:path';
import { appsRoot } from './app_root';
import { debugAppDirectory } from './app_debug_directory';
import { pluginAppDirectory } from './app_plugin_directory';

export function appDirectory(id: string, appLocation?: string): string {
	if (appLocation !== undefined) return path.join(appsRoot(appLocation), id);
	const installed = path.join(appsRoot(), id);
	// An installed folder may only hold a plugin app's data, so it wins only with a manifest.
	const hasManifest =
		existsSync(path.join(installed, 'manifest.json')) ||
		existsSync(path.join(installed, 'package.json'));
	return (
		debugAppDirectory(id) ??
		(hasManifest ? installed : pluginAppDirectory(id)?.directory) ??
		installed
	);
}
