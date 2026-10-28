import { readFileSync } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { pluginManifestSchema, type PluginManifest } from '../../shared/plugin_manifest';
import type { PluginKind } from '../../shared/plugin_types';
import type { ProviderManifest } from '../../shared/provider_types';
import { assertIcon } from './plugins_assert_icon';
import { assertNoLinks } from './plugins_assert_no_links';
import { pluginContents } from './plugins_contents';
import { readPluginModels } from './plugins_models_read';
import { pluginProvider } from './plugins_provider';
import { compareVersions } from './plugins_version_compare';

export type ReadPlugin = PluginManifest & {
	readonly contributes: Record<PluginKind, string[]>;
	readonly provider?: ProviderManifest;
};

export function readPlugin(
	directory: string,
	expectedId: string | null = path.basename(directory),
	builtIn = false
): ReadPlugin {
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
	// ponytail: built-in plugins ship with the app; their script workspaces may hold npm .bin links
	if (!builtIn) assertNoLinks(directory);
	if (manifest.icon) assertIcon(path.join(directory, 'assets'), manifest.icon);
	if (manifest.iconDark) assertIcon(path.join(directory, 'assets'), manifest.iconDark);
	const models = readPluginModels(directory);
	const provider = pluginProvider(models ? { ...manifest, models } : manifest);
	const contributes = { ...pluginContents(directory), providers: provider ? [manifest.id] : [] };
	if (Object.values(contributes).every((ids) => ids.length === 0)) {
		throw new Error('A plugin must contain at least one app, MCP server, provider, or skill.');
	}
	return { ...manifest, contributes, ...(provider && { provider }) };
}
