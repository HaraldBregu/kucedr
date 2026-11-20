import path from 'node:path';
import { HISTORY_LIMIT, type Library } from './library';
import { query } from './query';

// ponytail: Firefox keeps its search engine in a compressed file; it is not read
export function readFirefox(
	directory: string,
	want: { bookmarks: boolean; history: boolean }
): Partial<Library> {
	const file = path.join(directory, 'places.sqlite');
	const result: Partial<Library> = {};
	if (want.bookmarks)
		result.bookmarks = query<{ url: string; title: string | null }>(
			file,
			`SELECT p.url AS url, COALESCE(b.title, p.title) AS title FROM moz_bookmarks b JOIN moz_places p ON p.id = b.fk WHERE b.type = 1`
		).map((row) => ({ url: row.url, title: row.title ?? '' }));
	if (want.history)
		result.history = query<{ url: string; title: string | null; visit_count: number; last_visit_date: number | null }>(
			file,
			`SELECT url, title, visit_count, last_visit_date / 1000 AS last_visit_date FROM moz_places WHERE visit_count > 0 AND hidden = 0 ORDER BY last_visit_date DESC LIMIT ${HISTORY_LIMIT}`
		).map((row) => ({
			url: row.url,
			title: row.title ?? '',
			visits: Number(row.visit_count),
			last: Number(row.last_visit_date ?? 0),
		}));
	return result;
}
