import { z } from 'zod';

const idSchema = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Ids must use lowercase kebab-case.');
export const pluginVersionSchema = z
	.string()
	.regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/, 'Versions must be semver.');
const iconSchema = z
	.string()
	.regex(/^[\w-]+\.(?:png|svg|jpe?g|webp)$/, 'icon must be a png, svg, jpg, or webp file name.')
	.optional();
export const extensionManifestSchema = z
	.object({
		title: z.string().trim().min(1),
		description: z.string().trim().min(1),
		slot: z.enum(['sidebar', 'panel', 'toolbar', 'composer', 'settings']),
		icon: iconSchema,
	})
	.strict();

export const pluginManifestSchema = z
	.object({
		schemaVersion: z.literal(5),
		id: idSchema,
		title: z.string().trim().min(1),
		version: pluginVersionSchema,
		description: z.string().trim().min(1),
		author: z.string().trim().min(1).optional(),
		minAppVersion: pluginVersionSchema.optional(),
		icon: iconSchema,
	})
	.strict();

export type PluginManifest = z.infer<typeof pluginManifestSchema>;
export type ExtensionManifest = z.infer<typeof extensionManifestSchema>;
