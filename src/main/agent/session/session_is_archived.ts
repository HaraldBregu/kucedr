import { readFileSync } from 'node:fs';
import { infoFile } from './session_info_file';

export function isArchived(sessionsPath: string, sessionId: string): boolean {
	try {
		const info = JSON.parse(readFileSync(infoFile(sessionsPath, sessionId), 'utf8')) as {
			archived?: unknown;
		};
		return info.archived === true;
	} catch {
		return false;
	}
}
