import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { userDataLocation } from '../../shared/user_data_location';
import { storageLocation } from './paths';

export async function migrateLegacyStorageSettings(database: DatabaseSync): Promise<void> {
	const migrated = database.prepare(`SELECT 1 FROM migration_state
		WHERE name = 'legacy-storage-settings'`).get();
	if (migrated) return;
	let source = path.join(storageLocation(), 'settings.json');
	let contents: string;
	try {
		contents = await fs.readFile(source, 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		source = path.join(userDataLocation(), 'settings', 'app.json');
		try {
			contents = await fs.readFile(source, 'utf8');
		} catch (legacyError) {
			if ((legacyError as NodeJS.ErrnoException).code === 'ENOENT') return;
			throw legacyError;
		}
	}
	const legacy = source.endsWith('/app.json')
		? (JSON.parse(contents) as { cloud?: unknown }).cloud
		: JSON.parse(contents);
	if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) return;
	const sourceSettings = legacy as Record<string, unknown>;
	const safe = {
		providerId: typeof sourceSettings.providerId === 'string' ? sourceSettings.providerId : null,
		paths: Array.isArray(sourceSettings.paths)
			? sourceSettings.paths.filter((item): item is string => typeof item === 'string')
			: [],
		syncEnabled: sourceSettings.syncEnabled === true,
		syncCronExpression: typeof sourceSettings.syncCronExpression === 'string'
			? sourceSettings.syncCronExpression : null,
	};
	const settingsJson = JSON.stringify(safe);
	const hash = createHash('sha256').update(settingsJson).digest('hex');
	database.exec('BEGIN IMMEDIATE');
	try {
		database.prepare(`INSERT INTO legacy_storage_sources
			(source_path, source_hash, settings_json, recorded_at) VALUES (?, ?, ?, ?)
			ON CONFLICT(source_path) DO NOTHING`)
			.run(source, hash, settingsJson, new Date().toISOString());
		const stored = database.prepare(`SELECT source_hash, settings_json FROM legacy_storage_sources
			WHERE source_path = ?`).get(source) as { source_hash: string; settings_json: string };
		if (stored.source_hash !== hash || stored.settings_json !== settingsJson) {
			throw new Error('Legacy storage settings could not be verified.');
		}
		database.prepare(`INSERT INTO migration_state (name, completed_at) VALUES (?, ?)
			ON CONFLICT(name) DO NOTHING`).run('legacy-storage-settings', new Date().toISOString());
		database.exec('COMMIT');
	} catch (error) {
		database.exec('ROLLBACK');
		throw error;
	}
}
