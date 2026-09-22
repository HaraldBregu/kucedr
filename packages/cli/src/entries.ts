import fs from 'node:fs/promises';
import path from 'node:path';
import type { PluginManifest } from './manifest.js';

export async function validatePluginEntries(
	directory: string,
	manifest: PluginManifest
): Promise<void> {
	const root = await fs.realpath(directory);
	const entries = [
		...manifest.contributes.apps.map((item) => item.entry),
		...manifest.contributes.skills.map((item) => `${item.path}/SKILL.md`),
		...manifest.contributes.providers.flatMap((item) => [
			`providers/${item.id}/manifest.json`,
		]),
		...manifest.contributes.languages.map((item) => item.entry),
		...manifest.contributes.themes.map((item) => item.entry),
		...manifest.contributes.channels.map((item) => item.entry),
	];

	for (const entry of entries) {
		const requested = path.resolve(directory, ...entry.split('/'));
		let resolved: string;
		try {
			resolved = await fs.realpath(requested);
		} catch {
			throw new Error(`Plugin entry does not exist: ${entry}`);
		}

		if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
			throw new Error(`Plugin entry escapes its folder: ${entry}`);
		}

		if (!(await fs.stat(resolved)).isFile()) {
			throw new Error(`Plugin entry is not a file: ${entry}`);
		}
	}
}
