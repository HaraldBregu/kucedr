import type { SourceMessage, StoredEntry } from './types';
import { privateContent } from './private';

export function selectRecords(existing: StoredEntry[], messages: SourceMessage[]): StoredEntry[] {
	const terms = new Set(
		messages.flatMap(
			(message) => message.text.toLocaleLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []
		)
	);
	const ranked = existing
		.filter((entry) => !privateContent(entry.fact) && entry.fact.length <= 1000)
		.map((entry, index) => ({
			entry,
			index,
			score: [...terms].reduce(
				(score, term) => score + (entry.fact.toLocaleLowerCase().includes(term) ? 1 : 0),
				0
			),
		}))
		.sort(
			(left, right) =>
				right.score - left.score ||
				(left.entry.kind === 'summary' ? -1 : 0) - (right.entry.kind === 'summary' ? -1 : 0) ||
				right.index - left.index
		);
	const selected: StoredEntry[] = [];
	let size = 0;
	for (const { entry } of ranked) {
		if (selected.length >= 80 || size + entry.fact.length > 10_000) break;
		selected.push(entry);
		size += entry.fact.length;
	}
	return selected;
}
