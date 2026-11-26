import { chmodSync, mkdirSync } from 'node:fs';
import { userDataLocation } from './user_data_location';

export function restrictUserData(): void {
	if (process.platform === 'win32') return;
	try {
		const directory = userDataLocation();
		mkdirSync(directory, { recursive: true, mode: 0o700 });
		chmodSync(directory, 0o700);
	} catch {
		return;
	}
}
