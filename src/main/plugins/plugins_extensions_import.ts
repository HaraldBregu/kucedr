import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, lstat, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type { ExtensionImportResult } from '../../shared/plugin_types';
import { extensionsRoot } from './plugins_extensions_root';
import { readExtensionFolder } from './plugins_read_extension_folder';

/** Copies extension folders into the extensions root; an existing one with the same id is replaced. */
export async function importExtensions(sources: string[]): Promise<ExtensionImportResult> {
	const root = extensionsRoot();
	await mkdir(root, { recursive: true });
	const result: ExtensionImportResult = { imported: [], skipped: [] };
	for (const source of sources) {
		const id = path.basename(source);
		const staging = path.join(root, `.install-${randomUUID()}`);
		let backup: string | undefined;
		try {
			if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
				throw new Error('Folder names must use lowercase kebab-case.');
			}
			const stats = await lstat(source);
			if (stats.isSymbolicLink() || !stats.isDirectory()) throw new Error('Not a folder.');
			await cp(source, staging, { recursive: true, errorOnExist: true, verbatimSymlinks: true });
			readExtensionFolder(staging, id);
			if (!existsSync(path.join(staging, 'index.html'))) throw new Error('Missing index.html.');
			const destination = path.join(root, id);
			if (existsSync(destination)) {
				backup = path.join(root, `.backup-${randomUUID()}`);
				await rename(destination, backup);
			}
			try {
				await rename(staging, destination);
			} catch (error) {
				if (backup) await rename(backup, destination);
				backup = undefined;
				throw error;
			}
			result.imported.push(id);
		} catch (error) {
			result.skipped.push({
				name: id,
				reason: error instanceof Error ? error.message : String(error),
			});
		} finally {
			await rm(staging, { recursive: true, force: true });
			if (backup) await rm(backup, { recursive: true, force: true });
		}
	}
	return result;
}
