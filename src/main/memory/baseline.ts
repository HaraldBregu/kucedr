import type { SourceSession } from './types';

export function baseline(sources: SourceSession[]): Record<string, string[]> {
	return Object.fromEntries(
		sources.map((source) => [source.id, source.messages.map((message) => message.fingerprint)])
	);
}
