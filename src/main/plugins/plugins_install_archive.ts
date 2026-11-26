import type { Blob } from 'node:buffer';
import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Parser, x as extract } from 'tar';
import type { PluginInfo } from '../../shared/plugin_types';
import { MAX_ARCHIVE_BYTES, MAX_ARCHIVE_ENTRIES } from './limits';
import { installPlugin } from './plugins_install';

export async function installPluginArchive(archive: Blob): Promise<PluginInfo> {
	let bytes = 0;
	let entries = 0;
	const parser = new Parser({
		strict: true,
		filter: (_path, entry) => {
			entries += 1;
			const size = 'remain' in entry ? entry.remain : entry.size;
			bytes += size;
			if (entries > MAX_ARCHIVE_ENTRIES) {
				parser.abort(new Error(`Plugin archives can contain at most ${MAX_ARCHIVE_ENTRIES} entries.`));
			} else if (!Number.isSafeInteger(size) || size < 0 || bytes > MAX_ARCHIVE_BYTES) {
				parser.abort(new Error(`The unpacked plugin archive exceeds the limit of ${MAX_ARCHIVE_BYTES} bytes.`));
			}
			return false;
		},
	});
	await pipeline(archive.stream(), parser);

	const temporary = await mkdtemp(path.join(os.tmpdir(), 'kucedr-plugin-'));
	try {
		await pipeline(
			archive.stream(),
			extract({
				cwd: temporary,
				strict: true,
				filter: (_entryPath, entry) =>
					'type' in entry && (entry.type === 'File' || entry.type === 'Directory'),
			})
		);
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
