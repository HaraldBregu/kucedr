import fs from 'node:fs';
import type { SessionGoal } from './types';
import { goalPath } from './path';
import { goalSchema } from './schema';

export function readGoal(sessionDirectory: string): SessionGoal | undefined {
	const filePath = goalPath(sessionDirectory);
	if (!fs.existsSync(filePath)) return undefined;
	return goalSchema.parse(JSON.parse(fs.readFileSync(filePath, 'utf8'))) as SessionGoal;
}
