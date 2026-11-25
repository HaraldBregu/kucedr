import { type Dirent, readdirSync, readFileSync, statSync, utimesSync } from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from '../agent/session/session_atomic_write';
import { userDataLocation } from '../shared/user_data_location';
import { MAGIC } from './magic';
import { isVaultEnabled } from './state';
import { unseal } from './unseal';

export function convertVault(): void {
	const convert = (directory: string, deep: boolean, covered: (name: string) => boolean): void => {
		let entries: Dirent[];
		try {
			entries = readdirSync(directory, { withFileTypes: true });
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
			throw error;
		}
		const times = statSync(directory);
		let changed = false;
		for (const entry of entries) {
			if (entry.name.startsWith('.')) continue;
			const file = path.join(directory, entry.name);
			if (entry.isDirectory() && deep) convert(file, deep, covered);
			if (!entry.isFile() || !covered(entry.name)) continue;
			const raw = readFileSync(file);
			if (raw.subarray(0, MAGIC.length).equals(MAGIC) === isVaultEnabled()) continue;
			const stats = statSync(file);
			atomicWriteFile(file, unseal(raw));
			// Chat lists sort by these times, so a rewrite must not reorder them.
			utimesSync(file, stats.atime, stats.mtime);
			changed = true;
		}
		if (changed) utimesSync(directory, times.atime, times.mtime);
	};
	const root = userDataLocation();
	convert(path.join(root, 'sessions'), true, (name) => name !== 'run.jsonl');
	convert(path.join(root, 'memory'), false, (name) => name.endsWith('.md'));
	convert(path.join(root, 'health'), false, (name) => name === 'HEALTH.md');
}
