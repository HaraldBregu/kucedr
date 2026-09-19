import path from 'node:path';
import { userDataLocation } from '../shared/user_data_location';

export const MEMORY_FILE = 'MEMORY.md';
export const MEMORY_SETTINGS_FILE = 'settings.json';

export function memoryPath(): string {
	return path.join(userDataLocation(), 'memory', MEMORY_FILE);
}
