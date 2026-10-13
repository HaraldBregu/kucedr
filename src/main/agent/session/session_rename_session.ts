import { existsSync, readFileSync } from 'node:fs';
import { atomicWriteFile } from './session_atomic_write';
import { infoFile } from './session_info_file';
import { sessionsRoot } from './session_sessions_root';

export function renameSession(sessionId: string, location: string, title: string): void {
	const filePath = infoFile(sessionsRoot(location), sessionId);
	if (!existsSync(filePath)) throw new Error('Assistant session not found.');
	let info: Record<string, unknown>;
	try {
		info = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
	} catch {
		info = {};
	}
	atomicWriteFile(filePath, `${JSON.stringify({ ...info, title }, null, '\t')}\n`);
}
