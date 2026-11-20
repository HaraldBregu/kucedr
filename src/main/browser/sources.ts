import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import path from 'node:path';
import type { BrowserSource } from '../../shared/browser_import';
import { discover } from './discover';
import { profileFiles } from './files';
import { PROFILE_FILES } from './formats';
import { label } from './label';
import { readData } from './read';
import { dataRoots } from './roots';

export const SEARCH_DEPTH = 4;
const DATA = { bookmarks: true, history: true, settings: false };
const SMALL_FILE_BYTES = 1024 * 1024;

export const foundProfiles = new Map<string, string>();

export async function browserSources(): Promise<BrowserSource[]> {
	const sources: BrowserSource[] = [];
	foundProfiles.clear();
	for (const root of dataRoots())
		for (const directory of await discover(root, SEARCH_DEPTH)) {
			const files = profileFiles(directory, DATA);
			// A profile that was never used has small, empty files; it is not worth offering.
			const unused = files.every((file) => {
				if (statSync(file).size > SMALL_FILE_BYTES) return false;
				try {
					const data = readData(file, DATA);
					return !data.bookmarks?.length && !data.history?.length;
				} catch {
					return false;
				}
			});
			if (unused) continue;
			const id = createHash('sha256').update(directory).digest('hex').slice(0, 16);
			foundProfiles.set(id, directory);
			sources.push({
				id,
				...label(root, directory),
				kinds: (['bookmarks', 'history'] as const).filter((kind) =>
					files.some((file) => PROFILE_FILES[path.basename(file)].includes(kind))
				),
				used: Math.max(...files.map((file) => statSync(file).mtimeMs)),
			});
		}
	return sources.sort((a, b) => b.used - a.used);
}
