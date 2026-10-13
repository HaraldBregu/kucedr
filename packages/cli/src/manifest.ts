import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { isPluginPath } from './pluginpath.js';

const idSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const versionSchema = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
const providerSchema = z
	.object({
		id: idSchema,
	})
	.strict();
const appSchema = z
	.object({
		id: idSchema,
		title: z.string().trim().min(1),
		description: z.string().trim().min(1),
		category: z.string().trim().min(1),
		entry: z
			.string()
			.refine(isPluginPath)
			.refine((entry) => entry.toLowerCase().endsWith('.html'))
			.refine((entry) => entry.startsWith('apps/')),
		version: versionSchema.optional(),
	})
	.strict();
const skillSchema = z
	.object({
		id: idSchema,
		path: z
			.string()
			.refine(isPluginPath)
			.refine((path) => path.startsWith('skills/')),
	})
	.strict();
const mcpServerSchema = z.discriminatedUnion('type', [
	z
		.object({
			id: idSchema,
			name: z.string().trim().min(1).optional(),
			type: z.literal('http'),
			url: z.string().url(),
			requireApproval: z.enum(['always', 'never']).optional(),
		})
		.strict(),
	z
		.object({
			id: idSchema,
			name: z.string().trim().min(1).optional(),
			type: z.literal('stdio'),
			command: z.string().trim().min(1),
			args: z.array(z.string()).optional(),
			requireApproval: z.enum(['always', 'never']).optional(),
		})
		.strict(),
]);
const languageSchema = z
	.object({
		id: z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/),
		name: z.string().trim().min(1),
		entry: z
			.string()
			.refine(isPluginPath)
			.refine((entry) => entry.toLowerCase().endsWith('.json')),
	})
	.strict();
const themeSchema = z
	.object({
		id: idSchema,
		name: z.string().trim().min(1),
		entry: z
			.string()
			.refine(isPluginPath)
			.refine((entry) => entry.toLowerCase().endsWith('.json')),
	})
	.strict();
const channelSchema = z
	.object({
		id: idSchema,
		name: z.string().trim().min(1),
		description: z.string().trim().min(1),
		entry: z
			.string()
			.refine(isPluginPath)
			.refine((entry) => {
				const extension = entry.toLowerCase();
				return extension.endsWith('.js') || extension.endsWith('.mjs');
			}),
	})
	.strict();
const contributionsSchema = z
	.object({
		providers: z.array(providerSchema).default([]),
		skills: z.array(skillSchema).default([]),
		apps: z.array(appSchema).default([]),
		mcpServers: z.array(mcpServerSchema).default([]),
		languages: z.array(languageSchema).default([]),
		themes: z.array(themeSchema).default([]),
		channels: z.array(channelSchema).default([]),
	})
	.strict()
	.superRefine((contributions, context) => {
		const groups = Object.values(contributions);
		if (groups.every((group) => group.length === 0)) {
			context.addIssue({
				code: 'custom',
				message: 'A plugin must contribute at least one App.',
			});
		}
		for (const key of [
			'providers',
			'skills',
			'apps',
			'mcpServers',
			'languages',
			'themes',
			'channels',
		] as const) {
			const ids = new Set<string>();
			contributions[key].forEach((contribution, index) => {
				if (ids.has(contribution.id)) {
					context.addIssue({
						code: 'custom',
						message: `Duplicate ${key.slice(0, -1)} id: ${contribution.id}`,
						path: [key, index, 'id'],
					});
				}
				ids.add(contribution.id);
			});
		}
	});

export const pluginManifestSchema = z
	.object({
		schemaVersion: z.literal(4),
		id: idSchema,
		name: z.string().trim().min(1),
		version: versionSchema,
		description: z.string().trim().min(1),
		contributes: contributionsSchema,
	})
	.strict();

export type PluginManifest = z.infer<typeof pluginManifestSchema>;

export async function readPluginManifest(directory: string): Promise<PluginManifest> {
	const manifestPath = path.join(directory, 'manifest.json');
	let value: unknown;

	try {
		value = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as unknown;
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		throw new Error(`Could not read ${manifestPath}: ${message}`, { cause: error });
	}

	const parsed = pluginManifestSchema.safeParse(value);
	if (!parsed.success) {
		throw new Error(
			`Invalid Kucedr plugin manifest: ${parsed.error.issues.map((issue) => issue.message).join(' ')}`
		);
	}

	return parsed.data;
}
