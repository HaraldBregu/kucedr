import fs from 'node:fs';
import { goalPath } from './path';

export function clearGoal(sessionDirectory: string): void {
	fs.rmSync(goalPath(sessionDirectory), { force: true });
}
