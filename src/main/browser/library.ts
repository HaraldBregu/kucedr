import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { currentWorkspace } from '../workspaces/current';
import { aside } from './aside';
import type { Visit } from './history';
import { writeFileAtomic } from './write';

export const DEFAULT_SEARCH = 'https://duckduckgo.com/?q=%s';

export interface Library {
	bookmarks: { url: string; title: string }[];
	search: string;
}

const cache = new Map<string, Library>();

export function library(next?: Library): Library {
	const directory = currentWorkspace().browser;
	const file = path.join(directory, 'library.json');
	if (next) {
		if (existsSync(file)) copyFileSync(file, `${file}.bak`);
		writeFileAtomic(file, seal(JSON.stringify({ bookmarks: next.bookmarks, search: next.search })));
		cache.set(file, next);
	}
	let cached = cache.get(file);
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
		cache.set(file, cached);
	}
	return cached;
}
