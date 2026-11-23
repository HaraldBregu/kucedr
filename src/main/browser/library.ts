import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { userDataLocation } from '../shared/user_data_location';
import { aside } from './aside';
import type { Visit } from './history';
import { writeFileAtomic } from './write';

export const DEFAULT_SEARCH = 'https://duckduckgo.com/?q=%s';

export interface Library {
	bookmarks: { url: string; title: string }[];
	search: string;
}

let cached: Library | undefined;

export function library(next?: Library): Library {
	const directory = path.join(userDataLocation(), 'browser');
	const file = path.join(directory, 'library.json');
	if (next) {
		if (existsSync(file)) copyFileSync(file, `${file}.bak`);
		writeFileAtomic(file, JSON.stringify({ bookmarks: next.bookmarks, search: next.search }));
		cached = next;
	}
	if (!cached) {
		const empty: Library = { bookmarks: [], search: DEFAULT_SEARCH };
		const parse = (name: string): Library => {
			const { history, ...saved } = JSON.parse(readFileSync(name, 'utf8')) as Library & { history?: Visit[] };
			const moved = path.join(directory, 'history.json');
			if (history && !existsSync(moved)) writeFileAtomic(moved, JSON.stringify(history));
			return { ...empty, ...saved };
		};
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
