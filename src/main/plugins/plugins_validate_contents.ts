import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { PluginManifest } from '../../shared/plugin_manifest';
import { normalizeProviderId } from '../../shared/provider_types';
import { validateProviderManifest } from '../../shared/providers/validation';
import { readAppManifestFromDirectory } from '../apps/app_read';
import { readLocalMcpServer } from '../mcp/mcp_local_read';
import { validateSkill } from '../agent/skills/skills_validate';
import { resourceRoot } from '../shared/resource_root';

/** Install-time checks that each contribution is readable by the loader that will serve it. */
export function validatePluginContents(directory: string, manifest: PluginManifest): void {
	for (const { id } of manifest.contributes.apps) {
		const folder = path.join(directory, 'apps', id);
		const app = readAppManifestFromDirectory(folder);
		if (!app) throw new Error(`apps/${id} needs a valid app manifest.json.`);
		const entry = path.join(folder, ...app.metadata.entry.split('/'));
		if (!existsSync(entry) || !statSync(entry).isFile()) {
			throw new Error(`apps/${id}: entry ${app.metadata.entry} does not exist.`);
		}
	}
	for (const { id } of manifest.contributes.extensions) {
		const entry = path.join(directory, 'extensions', id, 'index.html');
		if (!existsSync(entry) || !statSync(entry).isFile()) {
			throw new Error(`extensions/${id} needs an index.html.`);
		}
	}
	for (const { id } of manifest.contributes.mcp_servers) {
		try {
			readLocalMcpServer(path.join(directory, 'mcp_servers', id));
		} catch (error) {
			throw new Error(`mcp_servers/${id}: ${error instanceof Error ? error.message : error}`, {
				cause: error,
			});
		}
	}
	for (const { id } of manifest.contributes.providers) {
		let value: unknown;
		try {
			value = JSON.parse(
				readFileSync(path.join(directory, 'providers', id, 'manifest.json'), 'utf8')
			);
		} catch (error) {
			throw new Error(`providers/${id} needs a valid manifest.json.`, { cause: error });
		}
		const errors = validateProviderManifest(value);
		if (errors.length > 0) throw new Error(`providers/${id}: ${errors.join(' ')}`);
		const providerId = normalizeProviderId((value as { providerId: string }).providerId);
		if (providerId !== id) throw new Error(`providers/${id}: providerId must be "${id}".`);
		// ponytail: bundled provider folders are named by provider id
		if (existsSync(path.join(resourceRoot(), 'resources/providers', id))) {
			throw new Error(`providers/${id}: a built-in provider already uses this id.`);
		}
	}
	for (const { id } of manifest.contributes.skills) {
		const validation = validateSkill(path.join(directory, 'skills', id));
		if (!validation.valid) {
			throw new Error(
				`skills/${id}: ${validation.issues.map((issue) => issue.message).join('; ')}`
			);
		}
	}
}
