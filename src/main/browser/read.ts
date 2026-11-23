import { closeSync, openSync, readFileSync, readSync, statSync } from 'node:fs';
import { LAYOUTS, type Kind } from './formats';
import type { Visit } from './history';
import type { Library as Stored } from './library';
import { withCopy } from './query';

const TEXT_LIMIT_BYTES = 64 * 1024 * 1024;
const ENTITIES: Readonly<Record<string, string>> = {
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&#39;': "'",
};

interface Node {
	readonly [key: string]: unknown;
}

// Works out what a file is from its content and returns whatever it holds: a database
// in a known layout, a bookmark tree or settings as JSON, or an exported bookmarks page.
export function readData(file: string, want: Readonly<Record<Kind, boolean>>): Partial<Library> {
	const head = Buffer.alloc(16);
	const descriptor = openSync(file, 'r');
	try {
		readSync(descriptor, head, 0, 16, 0);
	} finally {
		closeSync(descriptor);
	}
	if (head.toString('latin1', 0, 15) === 'SQLite format 3')
		return withCopy(file, (database) => {
			const tables = new Set(
				(database.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]).map(
					(row) => row.name
				)
			);
			const result: Partial<Library> = {};
			for (const layout of LAYOUTS) {
				if (!want[layout.kind] || !layout.tables.every((table) => tables.has(table))) continue;
				const rows = database.prepare(layout.sql).all() as unknown as (Partial<Visit> & { url: string })[];
				if (layout.kind === 'bookmarks')
					result.bookmarks = rows.map((row) => ({ url: row.url, title: row.title ?? '' }));
				else
					result.history = rows.map((row) => ({
						url: row.url,
						title: row.title ?? '',
						visits: Number(row.visits ?? 0),
						last: Number(row.last ?? 0),
					}));
			}
			return result;
		});
	if (statSync(file).size > TEXT_LIMIT_BYTES) return {};
	const text = readFileSync(file, 'utf8').trimStart();
	if (/^<!DOCTYPE NETSCAPE-Bookmark-file-1>/i.test(text))
		return want.bookmarks
			? {
					bookmarks: [...text.matchAll(/<A\s[^>]*?HREF="([^"]*)"[^>]*>([\s\S]*?)<\/A>/gi)].map((match) => ({
						url: match[1].replace(/&(amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity]),
						title: match[2]
							.replace(/<[^>]*>/g, '')
							.replace(/&(amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity])
							.trim(),
					})),
				}
			: {};
	if (!text.startsWith('{')) return {};
	let json: Node;
	try {
		json = JSON.parse(text) as Node;
	} catch {
		return {};
	}
	const result: Partial<Library> = {};
	const tree = json.roots ?? (Array.isArray(json.children) ? json : undefined);
	if (want.bookmarks && tree) {
		const bookmarks: Library['bookmarks'] = [];
		const walk = (value: unknown): void => {
			if (!value || typeof value !== 'object') return;
			if (Array.isArray(value)) return value.forEach(walk);
			const node = value as Node;
			const url = node.url ?? node.uri;
			if (typeof url === 'string')
				bookmarks.push({ url, title: String(node.name ?? node.title ?? '') });
			Object.values(node).forEach(walk);
		};
		walk(tree);
		result.bookmarks = bookmarks;
	}
	if (want.settings && json.default_search_provider_data && typeof json.default_search_provider_data === 'object') {
		const template = Object.values(json.default_search_provider_data as Node)
			.map((entry) => (entry as Node | null)?.url)
			.find((url): url is string => typeof url === 'string' && url.includes('{searchTerms}'));
		if (template)
			result.search = template
				.replace(/\{(\w+):baseURL\}/, 'https://www.$1.com/')
				.replace('{searchTerms}', '%s')
				.replace(/[?&][^=&{}]*=\{[^}]*\}/g, '')
				.replace(/\{[^}]*\}/g, '')
				.replace(/[?&]+$/, '');
	}
	return result;
}
