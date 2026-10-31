import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Reads `services/search/manifest.json`: the web search service a provider plugin offers. */
export function readPluginSearch(directory: string): unknown | undefined {
	const file = path.join(directory, 'services', 'search', 'manifest.json');
	if (!existsSync(file)) return undefined;
	try {
		return JSON.parse(readFileSync(file, 'utf8'));
	} catch (error) {
		throw new Error('services/search/manifest.json is not valid JSON.', { cause: error });
	}
}
