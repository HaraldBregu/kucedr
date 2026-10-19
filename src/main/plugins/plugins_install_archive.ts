import { existsSync, readdirSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { x as extract } from 'tar';
import type { PluginInfo } from '../../shared/plugin_types';
import { installPlugin } from './plugins_install';

export async function installPluginArchive(file: string): Promise<PluginInfo> {
	const temporary = await mkdtemp(path.join(os.tmpdir(), 'kucedr-plugin-'));
	try {
		await mkdir(temporary, { recursive: true });
		await extract({
			file,
			cwd: temporary,
			strict: true,
			filter: (_entryPath, entry) =>
				'type' in entry && (entry.type === 'File' || entry.type === 'Directory'),
		});
		if (existsSync(path.join(temporary, 'manifest.json'))) return await installPlugin(temporary);
		// npm tarballs wrap the files in package/; other archives may wrap them in one folder
		const entries = readdirSync(temporary, { withFileTypes: true }).filter(
			(entry) => !entry.name.startsWith('.')
		);
		const wrapper = entries.length === 1 && entries[0].isDirectory() ? entries[0].name : undefined;
		if (!wrapper || !existsSync(path.join(temporary, wrapper, 'manifest.json'))) {
			throw new Error('The archive has no manifest.json at its root.');
		}
		return await installPlugin(path.join(temporary, wrapper));
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
}
