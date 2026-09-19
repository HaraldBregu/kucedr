import { fingerprint } from './fingerprint';
import { parseMemories } from './parse';
import type { Extraction } from './types';

export function mergeMemories(
	markdown: string,
	entries: Extraction[],
	suppressed: string[]
): string {
	let result = markdown;
	for (const entry of entries) {
		const text = entry.text.trim().replace(/\s+/gu, ' ');
		const id = `memory-${fingerprint(text).slice(0, 16)}`;
		const canonical = text.toLocaleLowerCase().replace(/[\p{P}\p{S}\s]/gu, '');
		const existing = parseMemories(result);
		if (
			suppressed.includes(id) ||
			existing.some(
				(item) => item.fact.toLocaleLowerCase().replace(/[\p{P}\p{S}\s]/gu, '') === canonical
			)
		)
			continue;
		const removed = new Set(
			existing
				.filter((item) => entry.replaces.includes(item.id) && item.kind === entry.kind)
				.map((item) => item.lineIndex)
		);
		result = result
			.split('\n')
			.filter((_line, index) => !removed.has(index))
			.join('\n');
		result += `${result && !result.endsWith('\n') ? '\n' : ''}- [${id}] ${text} <!-- kucedr:${entry.kind}:${encodeURIComponent(entry.topic)} -->\n`;
	}
	return result;
}
