import fs from 'node:fs/promises';
import path from 'node:path';
import { userDataLocation } from '../../shared/user_data_location';
import type { SoundFile } from '../../../shared/sound_types';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.webm']);

export async function listSounds(): Promise<SoundFile[]> {
	const soundDir = path.resolve(userDataLocation(), 'sound');
	let entries;
	try {
		entries = await fs.readdir(soundDir, { withFileTypes: true });
	} catch {
		return [];
	}
	const files = await Promise.all(
		entries
			.filter(
				(entry) =>
					entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
			)
			.map(async (entry) => {
				const filePath = path.join(soundDir, entry.name);
				const stat = await fs.stat(filePath);
				return { name: entry.name, path: filePath, createdAt: stat.birthtimeMs || stat.mtimeMs };
			})
	);
	return files.sort((a, b) => b.createdAt - a.createdAt);
}
