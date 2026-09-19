import { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { userDataLocation } from '../shared/user_data_location';
import { memoryPath, MEMORY_SETTINGS_FILE } from './path';

export function prepareMemorySettings(): string {
	const directory = path.dirname(memoryPath());
	const target = path.join(directory, MEMORY_SETTINGS_FILE);
	const legacy = path.join(userDataLocation(), 'settings', 'memory.json');
	mkdirSync(directory, { recursive: true });
	if (!existsSync(legacy)) return directory;
	if (!existsSync(target)) {
		renameSync(legacy, target);
		return directory;
	}
	if (readFileSync(legacy).equals(readFileSync(target))) {
		unlinkSync(legacy);
		return directory;
	}
	const backup = path.join(directory, `settings.legacy-${Math.trunc(statSync(legacy).mtimeMs)}.json`);
	renameSync(legacy, backup);
	return directory;
}
