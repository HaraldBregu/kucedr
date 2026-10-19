import { readFileSync } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { pluginManifestSchema, type PluginManifest } from '../../shared/plugin_manifest';
import { assertNoLinks } from './plugins_assert_no_links';
import { validatePluginFolders } from './plugins_validate_folders';
import { compareVersions } from './plugins_version_compare';

export function readPlugin(
	directory: string,
	expectedId: string | null = path.basename(directory)
): PluginManifest {
	let value: unknown;
	try {
		value = JSON.parse(readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
	} catch (error) {
		throw new Error(
			error instanceof SyntaxError ? 'manifest.json is not valid JSON.' : 'Missing manifest.json.',
			{ cause: error }
		);
	}
	const parsed = pluginManifestSchema.safeParse(value);
	if (!parsed.success) {
		throw new Error(
			parsed.error.issues
				.map((issue) => `${issue.path.join('.') || 'manifest'}: ${issue.message}`)
				.join(' ')
		);
	}
	const manifest = parsed.data;
	if (expectedId !== null && manifest.id !== expectedId) {
		throw new Error(`The folder name must match the plugin id "${manifest.id}".`);
	}
	if (manifest.minAppVersion && compareVersions(app.getVersion(), manifest.minAppVersion) < 0) {
		throw new Error(`Requires Kucedr ${manifest.minAppVersion} or newer.`);
	}
	assertNoLinks(directory);
	validatePluginFolders(directory, manifest);
	return manifest;
}
