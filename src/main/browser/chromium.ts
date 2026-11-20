import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { HISTORY_LIMIT, type Library } from './library';
import { query } from './query';

const WEBKIT_EPOCH_MS = 11_644_473_600_000;

interface BookmarkNode {
	type?: string;
	name?: string;
	url?: string;
	children?: BookmarkNode[];
}

export function readChromium(
	directory: string,
	want: { bookmarks: boolean; history: boolean; settings: boolean }
): Partial<Library> {
	const result: Partial<Library> = {};
	const bookmarksFile = path.join(directory, 'Bookmarks');
	if (want.bookmarks && existsSync(bookmarksFile)) {
		const bookmarks: Library['bookmarks'] = [];
		const walk = (node: BookmarkNode): void => {
			if (node.type === 'url' && node.url) bookmarks.push({ url: node.url, title: node.name ?? '' });
			node.children?.forEach(walk);
		};
		const parsed = JSON.parse(readFileSync(bookmarksFile, 'utf8')) as { roots?: Record<string, BookmarkNode> };
		Object.values(parsed.roots ?? {}).forEach(walk);
		result.bookmarks = bookmarks;
	}
	const historyFile = path.join(directory, 'History');
	if (want.history && existsSync(historyFile))
		result.history = query<{ url: string; title: string | null; visit_count: number; last_visit_time: number }>(
			historyFile,
			`SELECT url, title, visit_count, last_visit_time / 1000 AS last_visit_time FROM urls WHERE hidden = 0 ORDER BY last_visit_time DESC LIMIT ${HISTORY_LIMIT}`
		).map((row) => ({
			url: row.url,
			title: row.title ?? '',
			visits: Number(row.visit_count),
			last: Number(row.last_visit_time) - WEBKIT_EPOCH_MS,
		}));
	if (want.settings) {
		const preferences = JSON.parse(readFileSync(path.join(directory, 'Preferences'), 'utf8')) as {
			default_search_provider_data?: { template_url_data?: { url?: string } };
		};
		const template = preferences.default_search_provider_data?.template_url_data?.url;
		// Chrome stores nothing, or a placeholder address, while Google is the default
		result.search =
			!template || template.includes('{google:baseURL}')
				? 'https://www.google.com/search?q=%s'
				: template
						.replace('{searchTerms}', '%s')
						.replace(/[?&][^=&]*=\{[^}]*\}/g, '')
						.replace(/\{[^}]*\}/g, '');
	}
	return result;
}
