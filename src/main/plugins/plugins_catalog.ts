import { z } from 'zod';
import { pluginVersionSchema } from '../../shared/plugin_manifest';
import { PLUGIN_KINDS, type CatalogPlugin } from '../../shared/plugin_types';

export const PLUGINS_CATALOG_URL = 'https://kucedr.github.io/kucedr-plugins/index.json';

const httpsUrl = z.string().startsWith('https://');
const catalogSchema = z.object({
	schemaVersion: z.literal(1),
	plugins: z.array(
		z.object({
			id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
			title: z.string().min(1),
			description: z.string(),
			author: z.string().min(1),
			categories: z.array(z.string()).default([]),
			icon: httpsUrl.optional(),
			iconDark: httpsUrl.optional(),
			version: pluginVersionSchema,
			minAppVersion: pluginVersionSchema.optional(),
			url: httpsUrl,
			integrity: z.string().startsWith('sha512-'),
			contains: z.array(z.enum(PLUGIN_KINDS)),
		})
	),
});

export async function listCatalog(): Promise<CatalogPlugin[]> {
	const response = await fetch(PLUGINS_CATALOG_URL);
	if (!response.ok) throw new Error(`Unable to load the plugin catalog (HTTP ${response.status}).`);
	const parsed = catalogSchema.safeParse(await response.json());
	if (!parsed.success) throw new Error('The plugin catalog is not valid.');
	return parsed.data.plugins;
}
