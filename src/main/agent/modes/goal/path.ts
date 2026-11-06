import path from 'node:path';

export function goalPath(sessionDirectory: string): string {
	return path.join(sessionDirectory, 'goal.json');
}
