import { privateContent } from './private';

export function recall(markdown: string, query: string): string {
	const terms = [...new Set(query.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])];
	const lines = markdown.split('\n').map((line, index) => ({
		line: line.replace(/ <!-- kucedr:(?:fact|summary):[^ ]* -->/g, ''), index,
		score: terms.reduce((score, term) => score + (line.toLocaleLowerCase().includes(term) ? 1 : 0), 0),
	})).filter(({ line, score }) => line.trim() && !privateContent(line) && (terms.length === 0 || score > 0));
	return lines.sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 12).map(({ line }) => line).join('\n').slice(0, 4000);
}
