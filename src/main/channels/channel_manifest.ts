import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { PluginSource } from '../../shared/plugin_types';

const id = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const text = z.string().trim().min(1);
const schema = z.object({
	id: z.string().regex(id),
	name: text,
	entry: text.refine((value) => !value.startsWith('/') && !value.includes('\\') && value.split('/').every((part) => part !== '' && part !== '.' && part !== '..')),
	credentials: z.array(z.object({ key: text, label: text, type: z.literal('password'), required: z.boolean() }).strict()),
	instructions: text.optional(),
}).strict();

export type PluginChannel = Omit<z.infer<typeof schema>, 'id'> & {
	id: string;
	plugin: PluginSource;
};

export function readPluginChannel(directory: string, plugin: PluginSource): PluginChannel {
	const name = path.basename(directory);
	if (!id.test(name)) throw new Error(`channels/${name} must be a kebab-case folder name.`);
	const parsed = schema.safeParse(JSON.parse(readFileSync(path.join(directory, 'manifest.json'), 'utf8')));
	if (!parsed.success) throw new Error(`channels/${name}/manifest.json: ${parsed.error.issues[0]?.message}`);
	if (parsed.data.id !== name) throw new Error(`channels/${name}: id must match the folder name.`);
	const entry = path.join(directory, ...parsed.data.entry.split('/'));
	if (!existsSync(entry) || !statSync(entry).isFile()) throw new Error(`channels/${name}: entry ${parsed.data.entry} does not exist.`);
	return { ...parsed.data, id: `${plugin.id}/${name}`, entry, plugin };
}
