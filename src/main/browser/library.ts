import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { userDataLocation } from '../shared/user_data_location';
import { aside } from './aside';
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

// A file that cannot be read is never written over: it is set aside and the previous copy is
// read instead, so the user can still recover it by hand.
export function library(next?: Library): Library {
	const file = path.join(userDataLocation(), 'browser', 'library.json');
	if (next) {
		if (existsSync(file)) copyFileSync(file, `${file}.bak`);
		writeFileAtomic(file, JSON.stringify(next));
		cached = next;
	}
	if (!cached) {
		const empty: Library = { bookmarks: [], history: [], search: DEFAULT_SEARCH };
		const parse = (name: string): Library => ({ ...empty, ...(JSON.parse(readFileSync(name, 'utf8')) as Library) });
		try {
			cached = parse(file);
		} catch {
			aside(file);
			try {
				cached = parse(`${file}.bak`);
			} catch {
				cached = empty;
			}
		}
	}
	return cached;
}
