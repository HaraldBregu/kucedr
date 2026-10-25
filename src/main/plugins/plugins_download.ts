import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { PluginInfo } from '../../shared/plugin_types';
import { installPluginArchive } from './plugins_install_archive';

const MAX_DOWNLOAD_BYTES = 200 * 1024 * 1024;

export async function downloadPlugin(url: string, integrity?: string): Promise<PluginInfo> {
	let target: URL;
	try {
		target = new URL(url.trim());
	} catch {
		throw new Error('Enter a valid plugin URL.');
	}
	if (target.protocol !== 'https:') throw new Error('Plugins can only be downloaded over https.');

	const response = await fetch(target);
	if (!response.ok || !response.body) throw new Error(`Download failed (HTTP ${response.status}).`);
	const tooLarge = new Error('The plugin archive is larger than 200 MB.');
	if (Number(response.headers.get('content-length')) > MAX_DOWNLOAD_BYTES) throw tooLarge;

	const chunks: Uint8Array[] = [];
	let size = 0;
	const reader = response.body.getReader();
	for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
		size += chunk.value.byteLength;
		if (size > MAX_DOWNLOAD_BYTES) {
			await reader.cancel();
			throw tooLarge;
		}
		chunks.push(chunk.value);
	}
	const archive = Buffer.concat(chunks);
	if (
		integrity &&
		`sha512-${createHash('sha512').update(archive).digest('base64')}` !== integrity
	) {
		throw new Error('The downloaded plugin does not match the catalog checksum.');
	}

	const temporary = await mkdtemp(path.join(os.tmpdir(), 'kucedr-plugin-download-'));
	try {
		const file = path.join(temporary, 'plugin.tgz');
		await writeFile(file, archive);
		return await installPluginArchive(file);
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
}
