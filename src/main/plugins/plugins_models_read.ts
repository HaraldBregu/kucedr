import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Reads `models/manifest.json`: the array of models a provider plugin offers. */
export function readPluginModels(directory: string): unknown[] | undefined {
	if (!existsSync(path.join(directory, 'models'))) return undefined;
	const file = path.join(directory, 'models', 'manifest.json');
	if (!existsSync(file)) throw new Error('models/manifest.json is missing.');
	let value: unknown;
	try {
		value = JSON.parse(readFileSync(file, 'utf8'));
	} catch (error) {
		throw new Error('models/manifest.json is not valid JSON.', { cause: error });
	}
	if (!Array.isArray(value) || value.length === 0) {
		throw new Error('models/manifest.json must be a non-empty array.');
	}
	return value;
}
