import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { PROFILE_FILES, PROFILE_MARKERS, PROFILES_ROOT_FILE } from './formats';

// Touching these macOS folders makes the system ask the user for access to contacts or
// other private data, which has nothing to do with browsing.
const PRIVATE = /^(com\.apple\.|AddressBook$|CallHistory|MobileSync$)/;
const FOLDER_BUDGET = 6_000;

export async function discover(root: string, depth: number): Promise<string[]> {
	const found: string[] = [];
	const holdsData = (directory: string): boolean =>
		Object.entries(PROFILE_FILES).some(
			([name, kinds]) => kinds.some((kind) => kind !== 'settings') && existsSync(path.join(directory, name))
		);
	let level = [root];
	let budget = FOLDER_BUDGET;
	for (let down = 0; down <= depth && level.length && budget > 0; down += 1) {
		const batch = level.slice(0, budget);
		const next: string[] = [];
		budget -= batch.length;
		await Promise.all(
			batch.map(async (directory) => {
				const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
				const files = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
				const folders = entries
					.filter((entry) => entry.isDirectory() && !PRIVATE.test(entry.name))
					.map((entry) => path.join(directory, entry.name));
				if (files.has(PROFILES_ROOT_FILE)) found.push(...[directory, ...folders].filter(holdsData));
				else if (PROFILE_MARKERS.some((name) => files.has(name))) found.push(directory);
				else next.push(...folders);
			})
		);
		level = next;
	}
	return found.sort();
}
