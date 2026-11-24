import { rankTools } from '../agent/runner/rank';
import { privateContent } from './private';

const generic = new Set(
	'about again are can could did do does from have hello help how i is it me my our please remember that their them there they this us was we what when where which who why would you your'.split(
		' '
	)
);

export function promptMemory(markdown: string, query: string): string {
	const durable: string[] = [];
	const summaries: string[] = [];
	let summaryLevel = 0;
	let record = -1;
	for (const line of markdown.split('\n')) {
		const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
		if (heading) {
			if (summaryLevel && heading[1].length <= summaryLevel) summaryLevel = 0;
			if (
				/^(?:summar(?:y|ies)|conversation summar(?:y|ies)|riassunt[io]|riepilog(?:o|hi))$/i.test(
					heading[2]
				)
			)
				summaryLevel = heading[1].length;
			record = -1;
		}
		if (heading && summaryLevel) continue;
		if (summaryLevel || /<!-- kucedr:summary:/.test(line)) {
			const clean = line.replace(/ <!-- kucedr:(?:fact|summary|created):[^ ]* -->/g, '').trim();
			if (!clean) {
				record = -1;
			} else if (record < 0 || /^[-*+]\s|^\d+[.)]\s/.test(clean)) {
				record = summaries.push(clean) - 1;
			} else {
				summaries[record] += '\n' + clean;
			}
		} else {
			durable.push(line);
		}
	}
	if (!summaries.length) return markdown;
	const terms = (query.toLocaleLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [])
		.filter((word) => word.length >= 3 && !generic.has(word))
		.join(' ');
	const relevant = rankTools(
		terms,
		[...new Set(summaries)]
			.filter((entry) => !privateContent(entry))
			.map((entry) => ({ text: entry, value: entry }))
	)
		.slice(0, 12)
		.join('\n')
		.slice(0, 4000);
	return [durable.join('\n').trimEnd(), relevant && '## Summaries\n' + relevant]
		.filter(Boolean)
		.join('\n\n');
}
