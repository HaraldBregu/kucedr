import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { PluginSource } from '../../../shared/plugin_types';
import { BEHAVIORS } from './behaviors';
import type { ModeDefinition } from './types';

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PROMPT_BYTES = 64 * 1024;
const BUNDLED_ONLY = ['protectedPrompt', 'model', 'behavior'] as const;
const text = z.string().trim().min(1);

const modeSchema = z
	.object({
		title: text.max(40),
		description: text.max(1024),
		command: z.string().regex(/^\/[a-z0-9]+(?:-[a-z0-9]+)*$/, 'command must look like /name'),
		persistent: z.boolean().optional(),
		protectedPrompt: z.boolean().optional(),
		tools: z.union([z.literal('read-only'), z.array(text)]).optional(),
		permissions: z.enum(['default', 'deny-asks']).optional(),
		shell: z.enum(['default', 'read-only', 'none']).optional(),
		effort: z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']).optional(),
		model: text.optional(),
		output: z
			.object({ envelope: z.string().regex(/^[a-z][a-z0-9_]*$/, 'envelope must be a tag name') })
			.strict()
			.optional(),
		action: z.object({ label: text.max(40), prompt: text.max(1024) }).strict().optional(),
		behavior: z.literal('goal').optional(),
	})
	.strict();

/** Reads and validates `modes/<id>/manifest.json` and `SYSTEM_PROMPT.md`. Trust comes from where the plugin loaded, not its id. */
export function readMode(directory: string, plugin: PluginSource, builtIn: boolean): ModeDefinition {
	const id = path.basename(directory);
	if (!ID.test(id)) throw new Error(`modes/${id} must be a kebab-case folder name.`);
	const parsed = modeSchema.safeParse(
		JSON.parse(readFileSync(path.join(directory, 'manifest.json'), 'utf8'))
	);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		throw new Error(`modes/${id}/manifest.json: ${issue?.path.join('.')} ${issue?.message}`);
	}
	const mode = parsed.data;
	if (!builtIn) {
		const field = BUNDLED_ONLY.find((name) => mode[name] !== undefined);
		if (field) throw new Error(`modes/${id}: "${field}" is limited to bundled plugins.`);
	}
	const file = path.join(directory, 'SYSTEM_PROMPT.md');
	if (!existsSync(file)) throw new Error(`modes/${id} needs a SYSTEM_PROMPT.md.`);
	if (statSync(file).size > MAX_PROMPT_BYTES) {
		throw new Error(`modes/${id}: SYSTEM_PROMPT.md is larger than 64 KB.`);
	}
	const prompt = readFileSync(file, 'utf8').trim();
	if (!prompt) throw new Error(`modes/${id}: SYSTEM_PROMPT.md is empty.`);
	return { ...mode, id, prompt, plugin };
}
