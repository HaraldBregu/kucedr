import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { restrictSettingsFile } from '../../shared/restrict_settings_file';
import { storageLocation } from './paths';

export function openStorageState(file = path.join(storageLocation(), 'state.sqlite')): DatabaseSync {
	mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
	const database = new DatabaseSync(file);
	try {
		if (file !== ':memory:') restrictSettingsFile(file);
		const check = database.prepare('PRAGMA quick_check').get() as { quick_check: string };
		if (check.quick_check !== 'ok') throw new Error('Local storage state is corrupt.');
		const version = (database.prepare('PRAGMA user_version').get() as { user_version: number })
			.user_version;
		if (version > 1) throw new Error('Local storage state requires a newer application.');
		if (version === 0) {
			database.exec(`
				BEGIN IMMEDIATE;
				CREATE TABLE IF NOT EXISTS local_versions (
					account_id TEXT NOT NULL, workspace_id TEXT NOT NULL,
					version_id TEXT NOT NULL, file_id TEXT NOT NULL, path TEXT NOT NULL,
					content_hash TEXT NOT NULL, content_size INTEGER NOT NULL,
					blob_path TEXT NOT NULL, device_id TEXT NOT NULL,
					created_at TEXT NOT NULL,
					PRIMARY KEY(account_id, workspace_id, version_id)
				) STRICT;
				CREATE TABLE IF NOT EXISTS version_parents (
					account_id TEXT NOT NULL, workspace_id TEXT NOT NULL,
					version_id TEXT NOT NULL, parent_id TEXT NOT NULL,
					PRIMARY KEY(account_id, workspace_id, version_id, parent_id),
					FOREIGN KEY(account_id, workspace_id, version_id)
						REFERENCES local_versions(account_id, workspace_id, version_id)
				) STRICT;
				CREATE TABLE IF NOT EXISTS pending_operations (
					account_id TEXT NOT NULL, workspace_id TEXT NOT NULL,
					operation_id TEXT NOT NULL, version_id TEXT NOT NULL,
					status TEXT NOT NULL CHECK(status IN ('pending', 'uploaded', 'synced')),
					attempts INTEGER NOT NULL DEFAULT 0, next_retry_at TEXT,
					remote_change_id TEXT, last_error TEXT,
					PRIMARY KEY(account_id, workspace_id, operation_id),
					FOREIGN KEY(account_id, workspace_id, version_id)
						REFERENCES local_versions(account_id, workspace_id, version_id)
				) STRICT;
				CREATE TABLE IF NOT EXISTS remote_versions (
					account_id TEXT NOT NULL, workspace_id TEXT NOT NULL,
					version_id TEXT NOT NULL, file_id TEXT NOT NULL,
					path TEXT NOT NULL, content_hash TEXT, content_size INTEGER,
					object_key TEXT, tombstone INTEGER NOT NULL DEFAULT 0,
					PRIMARY KEY(account_id, workspace_id, version_id)
				) STRICT;
				CREATE TABLE IF NOT EXISTS remote_heads (
					account_id TEXT NOT NULL, workspace_id TEXT NOT NULL,
					file_id TEXT NOT NULL, version_id TEXT NOT NULL,
					PRIMARY KEY(account_id, workspace_id, file_id, version_id)
				) STRICT;
				CREATE TABLE IF NOT EXISTS conflicts (
					account_id TEXT NOT NULL, workspace_id TEXT NOT NULL,
					file_id TEXT NOT NULL, version_id TEXT NOT NULL,
					PRIMARY KEY(account_id, workspace_id, file_id, version_id)
				) STRICT;
				CREATE TABLE IF NOT EXISTS sync_cursors (
					account_id TEXT NOT NULL, workspace_id TEXT NOT NULL,
					cursor TEXT NOT NULL,
					PRIMARY KEY(account_id, workspace_id)
				) STRICT;
				CREATE TABLE IF NOT EXISTS migration_state (
					name TEXT PRIMARY KEY, completed_at TEXT NOT NULL
				) STRICT;
				PRAGMA user_version = 1;
				COMMIT;
			`);
		}
		database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
		return database;
	} catch (error) {
		if (database.isOpen) database.close();
		throw error;
	}
}
