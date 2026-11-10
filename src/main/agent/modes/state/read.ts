import fs from 'node:fs';
import { statePath } from './path';
import { stateSchema } from './schema';
import type { ModeState } from './types';

export function readState(sessionDirectory: string, modeId: string): ModeState | undefined {
	const file = statePath(sessionDirectory, modeId);
	if (!fs.existsSync(file)) return undefined;
	try {
		return stateSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
	} catch {
		console.warn(`[modes] Ignoring invalid state for "${modeId}".`);
		return undefined;
	}
}
