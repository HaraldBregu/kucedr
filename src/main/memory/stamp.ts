import { parseMemories } from './parse';

export function stampMemories(
	next: string,
	previous: string,
	date = new Date(),
	source?: string
): string {
	const existing = new Map(parseMemories(previous).map((entry) => [entry.id, entry]));
	const timestamp = date.toISOString();
	return next
		.split('\n')
		.map((line) => {
			const clean = line.replace(/ <!-- kucedr:created:[^>]* -->/g, '');
			const entry = parseMemories(clean)[0];
			if (!entry) return clean;
			const prior = existing.get(entry.id);
			const createdAt = prior ? prior.createdAt : timestamp;
			const origin = entry.source ? undefined : prior ? prior.source : source;
			return `${clean}${origin ? ` <!-- kucedr:source:${origin} -->` : ''}${createdAt ? ` <!-- kucedr:created:${createdAt} -->` : ''}`;
		})
		.join('\n');
}
