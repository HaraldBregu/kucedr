import type { BrowserPlace } from '../../shared/browser_import';

const ENTITIES: Readonly<Record<string, string>> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
};

// The bookmarks page format every browser exports and imports, and read.ts reads back.
export function bookmarksHtml(bookmarks: readonly BrowserPlace[]): string {
	const escape = (text: string): string => text.replace(/[&<>"']/g, (character) => ENTITIES[character]);
	return [
		'<!DOCTYPE NETSCAPE-Bookmark-file-1>',
		'<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
		'<TITLE>Bookmarks</TITLE>',
		'<H1>Bookmarks</H1>',
		'<DL><p>',
		...bookmarks.map((item) => `    <DT><A HREF="${escape(item.url)}">${escape(item.title)}</A>`),
		'</DL><p>',
		'',
	].join('\n');
}
