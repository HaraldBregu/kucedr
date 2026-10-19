import { existsSync } from 'node:fs';
import { cp, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PluginInfo } from '../../shared/plugin_types';
import { listPlugins } from './plugins_list';
import { readPlugin } from './plugins_read';
import { pluginsRoot } from './plugins_root';
import { refreshPlugins } from './plugins_scan';
import { validatePluginContents } from './plugins_validate_contents';

/** Copies a plugin folder into the plugins root; an existing install with the same id is replaced. */
export async function installPlugin(source: string): Promise<PluginInfo> {
	const root = pluginsRoot();
	await mkdir(root, { recursive: true });
	const staging = path.join(root, `.install-${randomUUID()}`);
	let backup: string | undefined;
	try {
		await cp(source, staging, { recursive: true, errorOnExist: true, verbatimSymlinks: true });
		const manifest = readPlugin(staging, null);
		validatePluginContents(staging, manifest);
		const destination = path.join(root, manifest.id);
		if (existsSync(destination)) {
			backup = path.join(root, `.backup-${randomUUID()}`);
			await rename(destination, backup);
		}
		try {
			await rename(staging, destination);
		} catch (error) {
			if (backup) await rename(backup, destination);
			backup = undefined;
			throw error;
		}
		refreshPlugins();
		const installed = listPlugins().find((plugin) => plugin.id === manifest.id);
		if (!installed) throw new Error('The plugin could not be read after installation.');
		return installed;
	} finally {
		await rm(staging, { recursive: true, force: true });
		if (backup) await rm(backup, { recursive: true, force: true });
	}
}
