import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_INSTRUCTIONS = 4 * 1024;

const toolSchema = z
	.object({
		name: z.string().max(64).regex(ID, 'name must be kebab-case'),
		title: z.string().trim().min(1),
		description: z.string().trim().min(1).max(1024),
		inputSchema: z.looseObject({ type: z.literal('object') }),
		entry: z
			.string()
			.refine(
				(entry) =>
					!entry.startsWith('/') &&
					!entry.includes('\\') &&
					entry.split('/').every((part) => part !== '' && part !== '.' && part !== '..'),
				'entry must be a relative path'
			),
		fence: z.string().regex(ID, 'fence must be kebab-case').optional(),
		height: z.number().int().min(80).max(2000).default(320),
	})
	.strict();

export type PluginToolManifest = z.infer<typeof toolSchema> & {
	readonly directory: string;
	readonly instructions: string;
};

/** Reads and validates `tools/<id>/tool.json` and its `INSTRUCTIONS.md`. */
export function readPluginTool(directory: string): PluginToolManifest {
	const id = path.basename(directory);
	const parsed = toolSchema.safeParse(
		JSON.parse(readFileSync(path.join(directory, 'tool.json'), 'utf8'))
	);
	if (!parsed.success) throw new Error(`tools/${id}/tool.json: ${parsed.error.issues[0]?.message}`);
	if (parsed.data.name !== id) {
		throw new Error(`tools/${id}/tool.json: name must equal the folder name "${id}".`);
	}
	const entry = path.join(directory, ...parsed.data.entry.split('/'));
	if (!existsSync(entry) || !statSync(entry).isFile()) {
		throw new Error(`tools/${id}: entry ${parsed.data.entry} does not exist.`);
	}
	const instructionsFile = path.join(directory, 'INSTRUCTIONS.md');
	if (!existsSync(instructionsFile)) throw new Error(`tools/${id}: INSTRUCTIONS.md is missing.`);
	if (statSync(instructionsFile).size > MAX_INSTRUCTIONS) {
		throw new Error(`tools/${id}: INSTRUCTIONS.md is larger than 4 KB.`);
	}
	return {
		...parsed.data,
		directory,
		instructions: readFileSync(instructionsFile, 'utf8').trim(),
	};
}
