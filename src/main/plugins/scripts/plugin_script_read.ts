import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { PLUGIN_SCRIPT_TYPES } from '../../../shared/plugin_types';

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Hook scripts are never loaded by the agent, so they need no instructions. */
const HOOK_TYPES = new Set(['PRE_TOOL_USE', 'POST_TOOL_USE', 'PRE_MODEL_TURN', 'POST_MODEL_TURN']);
const text = z.string().trim().min(1);
const relativePath = (field: string) =>
	z
		.string()
		.refine(
			(file) =>
				!file.startsWith('/') &&
				!file.includes('\\') &&
				file.split('/').every((part) => part !== '' && part !== '.' && part !== '..'),
			`metadata.${field} must be a relative path`
		);

const manifestSchema = z
	.object({
		title: text,
		description: text.max(1024),
		author: text.optional(),
		type: z.enum(PLUGIN_SCRIPT_TYPES).default('UI'),
		metadata: z
			.object({
				version: text,
				category: text,
				entry: relativePath('entry'),
				instructions: relativePath('instructions')
					.refine(
						(file) => file.endsWith('.md'),
						'metadata.instructions must be a markdown file'
					)
					.optional(),
			})
			.strict(),
		inputSchema: z.looseObject({ type: z.literal('object') }).optional(),
		fence: z.string().regex(ID, 'fence must be kebab-case').optional(),
		height: z.number().int().min(80).max(2000).default(320),
	})
	.strict()
	.refine(
		(manifest) => HOOK_TYPES.has(manifest.type) || manifest.metadata.instructions !== undefined,
		'metadata.instructions is required'
	);

export type PluginScriptManifest = z.infer<typeof manifestSchema> & {
	/** The folder name. */
	readonly name: string;
	readonly directory: string;
};

/** Reads and validates `scripts/<id>/manifest.json`. */
export function readPluginScript(directory: string): PluginScriptManifest {
	const name = path.basename(directory);
	if (!ID.test(name)) throw new Error(`scripts/${name} must be a kebab-case folder name.`);
	const parsed = manifestSchema.safeParse(
		JSON.parse(readFileSync(path.join(directory, 'manifest.json'), 'utf8'))
	);
	if (!parsed.success) {
		throw new Error(`scripts/${name}/manifest.json: ${parsed.error.issues[0]?.message}`);
	}
	for (const field of ['entry', 'instructions'] as const) {
		const relative = parsed.data.metadata[field];
		if (relative === undefined) continue;
		const file = path.join(directory, ...relative.split('/'));
		if (!existsSync(file) || !statSync(file).isFile()) {
			throw new Error(`scripts/${name}: ${field} ${relative} does not exist.`);
		}
	}
	return { ...parsed.data, name, directory };
}
