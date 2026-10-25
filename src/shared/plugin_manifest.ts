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
export const pluginManifestSchema = z
	.object({
		schemaVersion: z.literal(5),
		id: idSchema,
		title: z.string().trim().min(1),
		version: pluginVersionSchema,
		description: z.string().trim().min(1),
		categories: z.array(z.string().trim().min(1)).optional(),
		author: z.string().trim().min(1),
		minAppVersion: pluginVersionSchema.optional(),
		icon: iconSchema,
		iconDark: iconSchema,
		// ponytail: provider services are checked by validateProviderManifest()
		authentication: z.unknown().optional(),
		apiKeyUrl: z.unknown().optional(),
		icon_dark_url: z.unknown().optional(),
		icon_light_url: z.unknown().optional(),
		instructions: z.unknown().optional(),
		models: z.unknown().optional(),
		mcp_servers: z.unknown().optional(),
		vector_databases: z.unknown().optional(),
		web_search: z.unknown().optional(),
		storage: z.unknown().optional(),
		bots: z.unknown().optional(),
		settings: z.unknown().optional(),
	})
	.strict();

export type PluginManifest = z.infer<typeof pluginManifestSchema>;
