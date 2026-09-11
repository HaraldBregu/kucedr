import { randomUUID } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { isAppId } from './app_id';
import { appsRoot } from './app_root';
import { readAppManifestFromDirectory } from './app_read';
import type { AppImportResult, AppImportSkipped } from '../../shared/installed_app_types';
import type { App } from './app_types';

function createSkipped(sourcePath: string, reason: string): AppImportSkipped {
	return {
		name: path.basename(sourcePath),
		sourcePath,
		reason,
	};
}

function readApp(directory: string): App | null {
	const id = path.basename(directory);
	const manifest = readAppManifestFromDirectory(directory);
	if (!manifest) return null;

	const entryPath = path.join(directory, manifest.metadata.entry);
	try {
		if (!existsSync(entryPath) || !statSync(entryPath).isFile()) return null;
	} catch {
		return null;
	}

	return { id, ...manifest };
}

export function importApps(sources: string[], appLocation?: string): AppImportResult {
	const apps: App[] = [];
	const skipped: AppImportSkipped[] = [];
	const root = path.resolve(appsRoot(appLocation));
	mkdirSync(root, { recursive: true });

	for (const source of sources) {
		const sourcePath = path.resolve(source);
		const id = path.basename(sourcePath);
		if (!isAppId(id)) {
			skipped.push(createSkipped(source, 'Invalid app folder name.'));
			continue;
		}
		if (
			!existsSync(sourcePath) ||
			lstatSync(sourcePath).isSymbolicLink() ||
			!statSync(sourcePath).isDirectory()
		) {
			skipped.push(createSkipped(source, 'Source folder is missing.'));
			continue;
		}

		const manifest = readApp(sourcePath);
		if (!manifest) {
			skipped.push(
				createSkipped(
					source,
					'Missing or invalid manifest. Expected manifest.json or package.json.'
				)
			);
			continue;
		}

		const destination = path.join(root, id);
		if (sourcePath === destination) {
			skipped.push(createSkipped(source, 'Source folder is already installed.'));
			continue;
		}

		const token = randomUUID();
		const staging = path.join(root, `.${id}-${token}.import`);
		const backup = path.join(root, `.${id}-${token}.backup`);
		let movedExisting = false;
		try {
			cpSync(sourcePath, staging, { recursive: true, errorOnExist: true, force: false });
			if (!readApp(staging)) throw new Error('Copied app is invalid.');
			if (existsSync(destination)) {
				renameSync(destination, backup);
				movedExisting = true;
			}
			try {
				renameSync(staging, destination);
			} catch (error) {
				if (movedExisting) renameSync(backup, destination);
				throw error;
			}
			if (movedExisting) rmSync(backup, { recursive: true, force: true });
			apps.push(manifest);
		} catch (error) {
			rmSync(staging, { recursive: true, force: true });
			if (movedExisting && !existsSync(destination) && existsSync(backup)) {
				renameSync(backup, destination);
			}
			skipped.push(
				createSkipped(
					source,
					`Unable to install app: ${error instanceof Error ? error.message : String(error)}`
				)
			);
		}
	}

	return { imported: apps, skipped };
}
