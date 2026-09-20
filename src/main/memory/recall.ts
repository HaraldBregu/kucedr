import { privateContent } from './private';

export function recall(markdown: string, query: string): string {
	const terms = [...new Set(query.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])];
	let section = '';
	const records = markdown.split('\n').flatMap((source, index) => {
		const heading = source.match(/^#{1,6}\s+(.+?)\s*$/);
		if (heading) {
			section = heading[1].toLocaleLowerCase();
			return [];
		}
		if (!/^\s*[-*]\s+\S/.test(source)) return [];
		const line = source.replace(/ <!-- kucedr:(?:fact|summary):[^ ]* -->/g, '').trim();
		if (!line || privateContent(line)) return [];
		const normalized = line
			.replace(/^\s*[-*]\s+/, '')
			.toLocaleLowerCase()
			.replace(/\s+/g, ' ');
		const core = /\b(profile|preference|preferences|profilo|preferenze)\b/.test(section);
		const score = terms.reduce(
			(total, term) => total + (normalized.includes(term) ? 1 : 0),
			0
		);
		return [{ line, normalized, index, core, score }];
	});
	const unique = <T extends { normalized: string }>(items: T[]): T[] => {
		const seen = new Set<string>();
		return items.filter((item) => {
			if (seen.has(item.normalized)) return false;
			seen.add(item.normalized);
			return true;
		});
	};
	const core = unique(records.filter((record) => record.core)).slice(0, 4);
	const coreKeys = new Set(core.map((record) => record.normalized));
	const relevant = unique(
		records
			.filter((record) => !coreKeys.has(record.normalized) && record.score > 0)
			.sort((left, right) => right.score - left.score || left.index - right.index)
	).slice(0, 12 - core.length);
	return [...core, ...relevant]
		.map(({ line }) => line)
		.join('\n')
		.slice(0, 4000);
}
