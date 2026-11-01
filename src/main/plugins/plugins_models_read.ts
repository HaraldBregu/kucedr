import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Reads `models/<id>/manifest.json`: one folder per model a provider plugin offers. */
export function readPluginModels(directory: string): unknown[] | undefined {
	const modelsDirectory = path.join(directory, 'models');
	if (!existsSync(modelsDirectory)) return undefined;
	const models: unknown[] = [];
	for (const entry of readdirSync(modelsDirectory, { withFileTypes: true })) {
		if (entry.name.startsWith('.')) continue;
		if (!entry.isDirectory()) throw new Error(`models/${entry.name} must be a folder.`);
		const file = path.join(modelsDirectory, entry.name, 'manifest.json');
		if (!existsSync(file)) throw new Error(`models/${entry.name}/manifest.json is missing.`);
		let value: unknown;
		try {
			value = JSON.parse(readFileSync(file, 'utf8'));
		} catch (error) {
			throw new Error(`models/${entry.name}/manifest.json is not valid JSON.`, { cause: error });
		}
		const id = (value as { id?: unknown } | null)?.id;
		if (
			typeof value !== 'object' ||
			typeof id !== 'string' ||
			(id !== entry.name && !id.endsWith(`/${entry.name}`))
		) {
			throw new Error(
				`models/${entry.name}/manifest.json must be a model with id "${entry.name}" or "<vendor>/${entry.name}".`
			);
		}
		models.push(value);
	}
	if (models.length === 0) throw new Error('models must contain at least one model folder.');
	return models;
}
