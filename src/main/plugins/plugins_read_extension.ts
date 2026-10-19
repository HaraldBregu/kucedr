import { readFileSync } from 'node:fs';
import path from 'node:path';
import { extensionManifestSchema, type ExtensionManifest } from '../../shared/plugin_manifest';
import { assertIcon } from './plugins_assert_icon';

export function readPluginExtension(directory: string, id: string): ExtensionManifest {
	const folder = path.join(directory, 'extensions', id);
	let value: unknown;
	try {
		value = JSON.parse(readFileSync(path.join(folder, 'manifest.json'), 'utf8'));
	} catch (error) {
		throw new Error(`extensions/${id} needs a valid manifest.json.`, { cause: error });
	}
	const parsed = extensionManifestSchema.safeParse(value);
	if (!parsed.success) {
		throw new Error(
			`extensions/${id}: ${parsed.error.issues
				.map((issue) => `${issue.path.join('.') || 'manifest'}: ${issue.message}`)
				.join(' ')}`
		);
	}
	if (parsed.data.icon) assertIcon(folder, parsed.data.icon);
	return parsed.data;
}
