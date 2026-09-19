import { fingerprint } from './fingerprint';
import type { StoredEntry } from './types';

export function parseMemories(text: string): StoredEntry[] {
	return text.split('\n').flatMap((line, lineIndex) => {
		const match = line.match(
			/^- (?:\[memory-[a-f0-9]{16}\] )?(.+?)(?: <!-- kucedr:(fact|summary):([^ ]*) -->)?$/i
		);
		if (!match) return [];
		const fact = match[1].trim().replace(/\s+/gu, ' ');
		if (!fact) return [];
		let topic = match[3];
		try {
			if (topic) topic = decodeURIComponent(topic);
		} catch {
			topic = undefined;
		}
		return [
			{
				id: `memory-${fingerprint(fact).slice(0, 16)}`,
				fact,
				lineIndex,
				...(match[2] ? { kind: match[2] as 'fact' | 'summary', topic } : {}),
			},
		];
	});
}
