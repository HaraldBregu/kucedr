import type { BrowserPlace } from '../../shared/browser_import';
import { library } from './library';

const LIMIT = 8;

export function suggest(text: string): BrowserPlace[] {
	const needle = text.trim().toLowerCase();
	if (needle.length < 2) return [];
	const { bookmarks, history } = library();
	const matches = (item: BrowserPlace): boolean =>
		item.url.toLowerCase().includes(needle) || item.title.toLowerCase().includes(needle);
	const found = new Map<string, BrowserPlace>();
	for (const item of bookmarks) if (found.size < LIMIT && matches(item)) found.set(item.url, item);
	for (const item of history.filter(matches).sort((a, b) => b.visits - a.visits))
		if (found.size < LIMIT && !found.has(item.url)) found.set(item.url, { url: item.url, title: item.title });
	return [...found.values()];
}
