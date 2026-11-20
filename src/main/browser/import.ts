import path from 'node:path';
import type { BrowserImportKinds, BrowserImportSummary } from '../../shared/browser_import';
import { HISTORY_LIMIT, library, type Visit } from './library';
import { readData } from './read';

export function importFiles(files: readonly string[], want: BrowserImportKinds): BrowserImportSummary {
	const current = library();
	const bookmarks = new Map(current.bookmarks.map((item) => [item.url, item]));
	const history = new Map<string, Visit>(current.history.map((item) => [item.url, item]));
	const known = { bookmarks: bookmarks.size, history: new Set(history.keys()) };
	const errors: string[] = [];
	let search: string | undefined;
	const web = (url: string): boolean => /^https?:\/\//i.test(url);
	for (const file of files) {
		try {
			const data = readData(file, want);
			for (const item of data.bookmarks ?? []) if (web(item.url) && !bookmarks.has(item.url)) bookmarks.set(item.url, item);
			for (const item of data.history ?? []) {
				if (!web(item.url)) continue;
				const known = history.get(item.url);
				if (!known || item.last > known.last) history.set(item.url, item);
			}
			if (data.search && web(data.search) && data.search.includes('%s')) search ??= data.search;
		} catch (error) {
			const name = path.join(path.basename(path.dirname(file)), path.basename(file));
			errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	library({
		bookmarks: [...bookmarks.values()],
		history: [...history.values()].sort((a, b) => b.last - a.last).slice(0, HISTORY_LIMIT),
		search: search ?? current.search,
	});
	return {
		bookmarks: bookmarks.size - before.bookmarks,
		history: Math.max(0, Math.min(history.size, HISTORY_LIMIT) - before.history),
		...(search ? { search } : {}),
		errors,
	};
}
