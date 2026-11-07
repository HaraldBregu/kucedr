import fs from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from '../../session/session_atomic_write';
import { statePath } from './path';
import type { ModeState } from './types';

export function writeState(sessionDirectory: string, state: ModeState): ModeState {
	const file = statePath(sessionDirectory, state.mode);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	atomicWriteFile(file, `${JSON.stringify(state, null, '\t')}\n`);
	return state;
}
