import { HISTORY_LIMIT } from './library';

export type Kind = 'bookmarks' | 'history' | 'settings';

// Browsers are recognised by the files their engine writes, never by product name.
// These are the files worth reading in a profile folder, and what each one can hold.
export const PROFILE_FILES: Readonly<Record<string, readonly Kind[]>> = {
	History: ['history'],
	Bookmarks: ['bookmarks'],
	Preferences: ['settings'],
	'places.sqlite': ['bookmarks', 'history'],
};

// A folder with this file keeps one profile per sub-folder, or is a profile itself.
export const PROFILES_ROOT_FILE = 'Local State';

// A folder with one of these files is a profile on its own.
export const PROFILE_MARKERS: readonly string[] = ['places.sqlite'];

const WEBKIT_EPOCH_MS = 11_644_473_600_000;
const COCOA_EPOCH_MS = 978_307_200_000;

// Database layouts, matched by the tables a file contains. Every query returns the same
// columns: url and title, plus visits and last (milliseconds since 1970) for history.
export const LAYOUTS: readonly {
	readonly tables: readonly string[];
	readonly kind: 'bookmarks' | 'history';
	readonly sql: string;
}[] = [
	{
		tables: ['urls'],
		kind: 'history',
		sql: `SELECT url, title, visit_count AS visits, last_visit_time / 1000 - ${WEBKIT_EPOCH_MS} AS last
			FROM urls WHERE hidden = 0 ORDER BY last_visit_time DESC LIMIT ${HISTORY_LIMIT}`,
	},
	{
		tables: ['moz_places'],
		kind: 'history',
		sql: `SELECT url, title, visit_count AS visits, COALESCE(last_visit_date, 0) / 1000 AS last
			FROM moz_places WHERE visit_count > 0 AND hidden = 0 ORDER BY last_visit_date DESC LIMIT ${HISTORY_LIMIT}`,
	},
	{
		tables: ['moz_places', 'moz_bookmarks'],
		kind: 'bookmarks',
		sql: `SELECT p.url AS url, COALESCE(b.title, p.title) AS title
			FROM moz_bookmarks b JOIN moz_places p ON p.id = b.fk WHERE b.type = 1`,
	},
	{
		tables: ['history_items', 'history_visits'],
		kind: 'history',
		sql: `SELECT i.url AS url, v.title AS title, i.visit_count AS visits,
				CAST(MAX(v.visit_time) * 1000 AS INTEGER) + ${COCOA_EPOCH_MS} AS last
			FROM history_items i JOIN history_visits v ON v.history_item = i.id
			GROUP BY i.id ORDER BY last DESC LIMIT ${HISTORY_LIMIT}`,
	},
];
