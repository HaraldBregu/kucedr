import { existsSync } from 'node:fs';
import { readSealed } from '../../vault/read';
import { atomicWriteFile } from './session_atomic_write';
import { infoFile } from './session_info_file';
import { sessionsRoot } from './session_sessions_root';

export function categorizeSession(sessionId: string, location: string, category: string | null): void {
	const filePath = infoFile(sessionsRoot(location), sessionId);
	if (!existsSync(filePath)) return;
	const content = readSealed(filePath);
	let info: Record<string, unknown>;
	try {
		info = JSON.parse(content) as Record<string, unknown>;
	} catch {
		info = {};
	}
	const { category: _previous, ...rest } = info;
	atomicWriteFile(filePath, `${JSON.stringify(category ? { ...rest, category } : rest, null, '\t')}\n`);
}
