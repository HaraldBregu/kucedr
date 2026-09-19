import path from 'node:path';
import { memoryPath } from './path';

export function sessionMemoryPath(sessionId: string): string {
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId))
		throw new Error('A valid memory session ID is required.');
	return path.join(path.dirname(memoryPath()), `${sessionId.toLowerCase()}.md`);
}
