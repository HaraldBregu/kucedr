import { existsSync } from 'node:fs';
import { readSealed } from '../../vault/read';
import { atomicWriteFile } from './session_atomic_write';
import { infoFile } from './session_info_file';

export function categorizeSession(sessionId: string, root: string, category: string | null): void {
	const filePath = infoFile(root, sessionId);
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
