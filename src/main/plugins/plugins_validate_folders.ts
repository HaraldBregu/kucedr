import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { PluginManifest } from '../../shared/plugin_manifest';
import { PLUGIN_KINDS } from '../../shared/plugin_types';

export function validatePluginFolders(directory: string, manifest: PluginManifest): void {
	for (const kind of PLUGIN_KINDS) {
		const declared = new Set(manifest.contributes[kind].map((item) => item.id));
		const kindDirectory = path.join(directory, kind);
		const present = existsSync(kindDirectory)
			? readdirSync(kindDirectory, { withFileTypes: true }).filter(
					(entry) => !entry.name.startsWith('.')
				)
			: [];
		for (const entry of present) {
			if (!entry.isDirectory()) throw new Error(`${kind}/${entry.name} must be a folder.`);
			if (!declared.has(entry.name)) {
				throw new Error(`${kind}/${entry.name} is not declared in contributes.${kind}.`);
			}
		}
		for (const id of declared) {
			if (!present.some((entry) => entry.name === id)) {
				throw new Error(`Missing folder ${kind}/${id}.`);
			}
		}
	}
}
