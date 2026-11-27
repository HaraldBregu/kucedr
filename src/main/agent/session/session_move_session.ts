import { existsSync } from 'node:fs';
import { readSealed } from '../../vault/read';
import { atomicWriteFile } from './session_atomic_write';
import { infoFile } from './session_info_file';

export function moveSession(sessionId: string, root: string, workspace: string): void {
	const filePath = infoFile(root, sessionId);
	if (!existsSync(filePath)) throw new Error('Assistant session not found.');
	const content = readSealed(filePath);
	let info: Record<string, unknown>;
	try {
		info = JSON.parse(content) as Record<string, unknown>;
	} catch {
		info = {};
	}
	atomicWriteFile(filePath, `${JSON.stringify({ ...info, workspace }, null, '\t')}\n`);
}
