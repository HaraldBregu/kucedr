import fs from 'node:fs';
import { atomicWriteFile } from '../session/session_atomic_write';
import { goalPath } from './path';
import type { SessionGoal } from './types';

export function writeGoal(sessionDirectory: string, goal: SessionGoal): SessionGoal {
	fs.mkdirSync(sessionDirectory, { recursive: true });
	atomicWriteFile(goalPath(sessionDirectory), `${JSON.stringify(goal, null, '\t')}\n`);
	return goal;
}
