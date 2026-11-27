import { DEFAULT_WORKSPACE } from '../../../shared/workspaces_types';
import { readSealed } from '../../vault/read';
import { infoFile } from './session_info_file';

export function sessionWorkspace(sessionsPath: string, sessionId: string): string {
	try {
		const info = JSON.parse(readSealed(infoFile(sessionsPath, sessionId))) as {
			workspace?: unknown;
		};
		return typeof info.workspace === 'string' ? info.workspace : DEFAULT_WORKSPACE;
	} catch {
		return DEFAULT_WORKSPACE;
	}
}
