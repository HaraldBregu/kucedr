import fs from 'node:fs';
import { readSealed } from '../../../vault/read';
import { statePath } from './path';
import { stateSchema } from './schema';
import type { ModeState } from './types';

export function readState(sessionDirectory: string, modeId: string): ModeState | undefined {
	const file = statePath(sessionDirectory, modeId);
	if (!fs.existsSync(file)) return undefined;
	const content = readSealed(file);
	try {
		return stateSchema.parse(JSON.parse(content));
	} catch {
		console.warn(`[modes] Ignoring invalid state for "${modeId}".`);
		return undefined;
	}
}
