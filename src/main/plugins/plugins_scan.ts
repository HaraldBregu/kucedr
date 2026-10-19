import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { bundledPluginsRoot } from './plugins_bundled_root';
import { pluginsRoot } from './plugins_root';
import { readPlugin, type ReadPlugin } from './plugins_read';

export interface ScannedPlugin {
	readonly id: string;
	readonly directory: string;
	readonly builtIn: boolean;
	readonly manifest?: ReadPlugin;
	readonly error?: string;
}

let cache: readonly ScannedPlugin[] | undefined;

/** Installed plugins override built-in plugins with the same id. */
export function scanPlugins(): readonly ScannedPlugin[] {
	if (cache) return cache;
	const found = new Map<string, ScannedPlugin>();
	for (const [root, builtIn] of [
		[bundledPluginsRoot(), true],
		[pluginsRoot(), false],
	] as const) {
		if (!existsSync(root)) continue;
		for (const entry of readdirSync(root, { withFileTypes: true })) {
			if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
			const directory = path.join(root, entry.name);
			try {
				found.set(entry.name, {
					id: entry.name,
					directory,
					builtIn,
					manifest: readPlugin(directory),
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				found.set(entry.name, { id: entry.name, directory, builtIn, error: message });
			}
		}
	}
	cache = [...found.values()].sort((left, right) => left.id.localeCompare(right.id));
	return cache;
}

export function refreshPlugins(): void {
	cache = undefined;
}
