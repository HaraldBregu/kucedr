import { randomUUID } from 'node:crypto';
import { type Dirent, readdirSync, readFileSync, renameSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from '../agent/session/session_atomic_write';
import { userDataLocation } from '../shared/user_data_location';
import { MAGIC } from './magic';
import { sealLine } from './seal_line';
import { isVaultEnabled } from './state';
import { unseal } from './unseal';
import { unsealLine } from './unseal_line';

export function convertVault(): void {
	const convert = (
		directory: string,
		deep: boolean,
		covered: (file: string) => 'file' | 'lines' | undefined
	): void => {
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
			const mode = entry.isFile() ? covered(file) : undefined;
			if (!mode) continue;
			const raw = readFileSync(file);
			const stats = statSync(file);
			if (mode === 'lines') {
				const text = raw.toString('utf8');
				const next = text
					.split('\n')
					.map((line) => (line ? sealLine(unsealLine(line)) : line))
					.join('\n');
				if (next === text) continue;
				const temporary = path.join(directory, `.${entry.name}.${randomUUID()}.tmp`);
				writeFileSync(temporary, next, 'utf8');
				renameSync(temporary, file);
			} else {
				if (raw.subarray(0, MAGIC.length).equals(MAGIC) === isVaultEnabled()) continue;
				atomicWriteFile(file, unseal(raw));
			}
			// Chat lists sort by these times, so a rewrite must not reorder them.
			utimesSync(file, stats.atime, stats.mtime);
			changed = true;
		}
		if (changed) utimesSync(directory, times.atime, times.mtime);
	};
	const data = userDataLocation();
	const named =
		(...names: string[]) =>
		(file: string) =>
			names.includes(path.basename(file)) ? ('file' as const) : undefined;
	const coder = (file: string) =>
		file.endsWith('.jsonl') ? ('lines' as const) : file.endsWith('.json') ? ('file' as const) : undefined;
	convert(path.join(data, 'sessions'), true, (file) =>
		path.basename(file) === 'run.jsonl' ? 'lines' : 'file'
	);
	convert(path.join(data, 'memory'), false, (file) => (file.endsWith('.md') ? 'file' : undefined));
	convert(path.join(data, 'health'), false, named('HEALTH.md'));
	for (const folder of ['user', 'soul', 'identity']) convert(path.join(data, folder), false, named('settings.json'));
	convert(path.join(data, 'browser'), true, named('history.json', 'tabs.json', 'library.json', 'library.json.bak'));
	convert(path.join(data, 'coder', 'sessions', 'records'), false, coder);
	convert(path.join(data, 'coder', 'workspaces'), true, (file) =>
		path.basename(path.dirname(file)) === 'sessions' ? coder(file) : undefined
	);
}
