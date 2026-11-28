import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { CHAT_RETENTION_DAYS } from '../../shared/data_types';
import { writeFileAtomic } from '../browser/write';
import { userDataLocation } from '../shared/user_data_location';

const file = path.join(userDataLocation(), 'settings', 'retention.json');

export function getChatRetention(): number {
	try {
		const { days } = JSON.parse(readFileSync(file, 'utf8')) as { days?: unknown };
		return typeof days === 'number' && CHAT_RETENTION_DAYS.includes(days) ? days : 0;
	} catch {
		return 0;
	}
}

export function setChatRetention(days: number): number {
	if (!CHAT_RETENTION_DAYS.includes(days)) throw new Error('Invalid chat retention period.');
	mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
	writeFileAtomic(file, JSON.stringify({ days }));
	return days;
}
