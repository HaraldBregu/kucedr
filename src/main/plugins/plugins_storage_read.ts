import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Reads the `storage` service a plugin's storage script (`scripts/<id>/manifest.json`, category "storage") declares. */
export function readPluginStorage(directory: string): unknown {
	const scripts = path.join(directory, 'scripts');
	if (!existsSync(scripts)) return undefined;
	for (const entry of readdirSync(scripts, { withFileTypes: true })) {
		const file = path.join(scripts, entry.name, 'manifest.json');
		if (!entry.isDirectory() || entry.name.startsWith('.') || !existsSync(file)) continue;
		let manifest: { metadata?: { category?: unknown }; storage?: unknown };
		try {
			manifest = JSON.parse(readFileSync(file, 'utf8'));
		} catch (error) {
			throw new Error(`scripts/${entry.name}/manifest.json is not valid JSON.`, { cause: error });
		}
		if (manifest.metadata?.category === 'storage') return manifest.storage;
	}
	return undefined;
}
