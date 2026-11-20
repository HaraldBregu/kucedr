import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { userDataLocation } from '../shared/user_data_location';
import { writeFileAtomic } from './write';

export const DEFAULT_SEARCH = 'https://duckduckgo.com/?q=%s';
export const HISTORY_LIMIT = 5_000;

export interface Visit {
	url: string;
	title: string;
	visits: number;
	last: number;
}

export interface Library {
	bookmarks: { url: string; title: string }[];
	history: Visit[];
	search: string;
}

let cached: Library | undefined;

export function library(next?: Library): Library {
	const file = path.join(userDataLocation(), 'browser', 'library.json');
	if (next) {
		restrictSettingsFile(file);
		writeFileSync(file, JSON.stringify(next), { mode: 0o600 });
		cached = next;
	}
	if (!cached) {
		const empty: Library = { bookmarks: [], history: [], search: DEFAULT_SEARCH };
		try {
			cached = existsSync(file) ? { ...empty, ...(JSON.parse(readFileSync(file, 'utf8')) as Library) } : empty;
		} catch {
			cached = empty;
		}
	}
	return cached;
}
