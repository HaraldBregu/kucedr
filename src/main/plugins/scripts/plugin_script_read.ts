import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_INSTRUCTIONS = 4 * 1024;
const text = z.string().trim().min(1);

const manifestSchema = z
	.object({
		title: text,
		description: text.max(1024),
		author: text.optional(),
		metadata: z
			.object({
				version: text,
				category: text,
				entry: z
					.string()
					.refine(
						(entry) =>
							!entry.startsWith('/') &&
							!entry.includes('\\') &&
							entry.split('/').every((part) => part !== '' && part !== '.' && part !== '..'),
						'metadata.entry must be a relative path'
					),
			})
			.strict(),
		inputSchema: z.looseObject({ type: z.literal('object') }),
		fence: z.string().regex(ID, 'fence must be kebab-case').optional(),
		height: z.number().int().min(80).max(2000).default(320),
	})
	.strict();

export type PluginScriptManifest = z.infer<typeof manifestSchema> & {
	/** The folder name. */
	readonly name: string;
	readonly directory: string;
	readonly instructions: string;
};

/** Reads and validates `scripts/<id>/manifest.json` and its `INSTRUCTIONS.md`. */
export function readPluginScript(directory: string): PluginScriptManifest {
	const name = path.basename(directory);
	if (!ID.test(name)) throw new Error(`scripts/${name} must be a kebab-case folder name.`);
	const parsed = manifestSchema.safeParse(
		JSON.parse(readFileSync(path.join(directory, 'manifest.json'), 'utf8'))
	);
	if (!parsed.success) {
		throw new Error(`scripts/${name}/manifest.json: ${parsed.error.issues[0]?.message}`);
	}
	const entry = path.join(directory, ...parsed.data.metadata.entry.split('/'));
	if (!existsSync(entry) || !statSync(entry).isFile()) {
		throw new Error(`scripts/${name}: entry ${parsed.data.metadata.entry} does not exist.`);
	}
	const instructionsFile = path.join(directory, 'INSTRUCTIONS.md');
	if (!existsSync(instructionsFile)) throw new Error(`scripts/${name}: INSTRUCTIONS.md is missing.`);
	if (statSync(instructionsFile).size > MAX_INSTRUCTIONS) {
		throw new Error(`scripts/${name}: INSTRUCTIONS.md is larger than 4 KB.`);
	}
	return {
		...parsed.data,
		name,
		directory,
		instructions: readFileSync(instructionsFile, 'utf8').trim(),
	};
}
