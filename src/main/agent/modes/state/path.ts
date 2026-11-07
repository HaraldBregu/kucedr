import path from 'node:path';

export function statePath(sessionDirectory: string, modeId: string): string {
	return path.join(sessionDirectory, 'modes', `${modeId}.json`);
}
