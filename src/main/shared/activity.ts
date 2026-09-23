import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ActivityDay } from '../../shared/app_types';

const LOG_FILE = /^(\d{4}-\d{2}-\d{2})\.log$/;

export async function readActivity(logDirectory: string | null): Promise<ActivityDay[]> {
	if (!logDirectory) return [];

	try {
		const files = await readdir(logDirectory);
		const activities = await Promise.all(
			files.flatMap((file) => {
				const match = LOG_FILE.exec(file);
				if (!match) return [];

				return readFile(path.join(logDirectory, file), 'utf8').then((contents) => ({
					date: match[1],
					value: contents.split(/\r?\n/).filter(Boolean).length,
				}));
			})
		);

		return activities.sort((left, right) => left.date.localeCompare(right.date));
	} catch {
		return [];
	}
}
