import { fingerprint } from './fingerprint';
import type { StoredEntry } from './types';

export function parseMemories(text: string): StoredEntry[] {
	let section: string | undefined;
	return text.split('\n').flatMap((line, lineIndex) => {
		const heading = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
		if (heading) section = heading[1];
		const match = line.match(
			/^\s*[-*]\s+(?:\[memory-[a-f0-9]{16}\] )?(.+?)(?: <!-- kucedr:(?:fact|summary):[^ ]* -->)?(?: <!-- kucedr:source:([a-z0-9-]+) -->)?(?: <!-- kucedr:created:([^ ]+) -->)?$/i
		);
		if (!match) return [];
		const fact = match[1].trim().replace(/\s+/gu, ' ');
		if (!fact) return [];
		const source = match[2];
		const createdAt = match[3];
		return [
			{
				id: `memory-${fingerprint(fact).slice(0, 16)}`,
				fact,
				lineIndex,
				...(section ? { section } : {}),
				...(source ? { source } : {}),
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
