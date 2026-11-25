import { readSealed } from '../../vault/read';
import { infoFile } from './session_info_file';

export function isArchived(sessionsPath: string, sessionId: string): boolean {
	try {
		const info = JSON.parse(readSealed(infoFile(sessionsPath, sessionId))) as {
			archived?: unknown;
		};
		return info.archived === true;
	} catch {
		return false;
	}
}
