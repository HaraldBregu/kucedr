import path from 'node:path';
import { isUuid } from '../agent/session/session_is_uuid';
import { memoryPath } from './path';

export function sessionMemoryPath(sessionId: string): string {
	if (!isUuid(sessionId)) throw new Error('A valid memory session ID is required.');
	return path.join(path.dirname(memoryPath()), `${sessionId.toLowerCase()}.md`);
}
