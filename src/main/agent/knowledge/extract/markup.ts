import { decodeEntities } from './entities';

// Text of an XML or HTML document: line breaks where blocks end, tabs between cells.
export function markupText(markup: string, lines: RegExp, cells?: RegExp): string {
	const marked = markup.replace(lines, '\n');
	return decodeEntities((cells ? marked.replace(cells, '\t') : marked).replace(/<[^>]*>/g, ''))
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}
