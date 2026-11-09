import { fingerprint } from './fingerprint';
import type { StoredEntry } from './types';

export function parseMemories(text: string): StoredEntry[] {
	return text.split('\n').flatMap((line, lineIndex) => {
		const match = line.match(
			/^\s*[-*]\s+(?:\[memory-[a-f0-9]{16}\] )?(.+?)(?: <!-- kucedr:(?:fact|summary):[^ ]* -->)?(?: <!-- kucedr:created:([^ ]+) -->)?$/i
		);
		if (!match) return [];
		const fact = match[1].trim().replace(/\s+/gu, ' ');
		if (!fact) return [];
		const createdAt = match[2];
		return [
			{
				id: `memory-${fingerprint(fact).slice(0, 16)}`,
				fact,
				lineIndex,
				...(createdAt &&
				/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(createdAt) &&
				!Number.isNaN(Date.parse(createdAt)) &&
				new Date(createdAt).toISOString() === createdAt
					? { createdAt }
					: {}),
			},
		];
	});
}
