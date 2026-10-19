import { z } from 'zod';

const idSchema = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Ids must use lowercase kebab-case.');
export const pluginVersionSchema = z
	.string()
	.regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/, 'Versions must be semver.');
const uniqueIds = (items: { id: string }[]) =>
	new Set(items.map((item) => item.id)).size === items.length;
const contributionsSchema = z
	.array(z.object({ id: idSchema }).strict())
	.default([])
	.refine(uniqueIds, { message: 'Contribution ids must be unique.' });
const extensionsSchema = z
	.array(
		z
			.object({
				id: idSchema,
				title: z.string().trim().min(1),
				slot: z.enum(['sidebar', 'panel', 'toolbar', 'composer', 'settings']),
			})
			.strict()
	)
	.default([])
	.refine(uniqueIds, { message: 'Contribution ids must be unique.' });

export const pluginManifestSchema = z
	.object({
		schemaVersion: z.literal(5),
		id: idSchema,
		name: z.string().trim().min(1),
		version: pluginVersionSchema,
		description: z.string().trim().min(1),
		author: z.string().trim().min(1).optional(),
		minAppVersion: pluginVersionSchema.optional(),
		contributes: z
			.object({
				apps: contributionsSchema,
				extensions: extensionsSchema,
				mcp_servers: contributionsSchema,
				providers: contributionsSchema,
				skills: contributionsSchema,
			})
			.strict()
			.refine((groups) => Object.values(groups).some((items) => items.length > 0), {
				message:
					'A plugin must contribute at least one app, extension, MCP server, provider, or skill.',
			}),
	})
	.strict();

export type PluginManifest = z.infer<typeof pluginManifestSchema>;
