import { readFileSync } from 'node:fs';
import path from 'node:path';
import { extensionManifestSchema, type ExtensionManifest } from '../../shared/plugin_manifest';
import { assertIcon } from './plugins_assert_icon';

export function readExtensionFolder(folder: string, label: string): ExtensionManifest {
	let value: unknown;
	try {
		value = JSON.parse(readFileSync(path.join(folder, 'manifest.json'), 'utf8'));
	} catch (error) {
		throw new Error(`${label} needs a valid manifest.json.`, { cause: error });
	}
	const parsed = extensionManifestSchema.safeParse(value);
	if (!parsed.success) {
		throw new Error(
			`${label}: ${parsed.error.issues
				.map((issue) => `${issue.path.join('.') || 'manifest'}: ${issue.message}`)
				.join(' ')}`
		);
	}
	if (parsed.data.icon) assertIcon(folder, parsed.data.icon);
	return parsed.data;
}
