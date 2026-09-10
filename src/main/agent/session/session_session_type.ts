import { readFileSync } from 'node:fs';
import type { SessionCategory } from './session_types';
import { DEFAULT_CATEGORY } from './session_types';
import { infoFile } from './session_info_file';

export function sessionType(sessionsPath: string, sessionId: string): SessionCategory {
	try {
		const info = JSON.parse(readFileSync(infoFile(sessionsPath, sessionId), 'utf8')) as {
			type?: unknown;
		};
		const type = info?.type;
		return type === 'main' || type === 'task' || type === 'health' || type === 'bot' || type === 'voice'
			? type
			: DEFAULT_CATEGORY;
	} catch {
		return DEFAULT_CATEGORY;
	}
}
