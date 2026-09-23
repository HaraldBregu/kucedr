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
		if (version > 2) throw new Error('Local storage state requires a newer application.');
		if (version === 0) {
			database.exec(`
				BEGIN IMMEDIATE;
				CREATE TABLE IF NOT EXISTS local_versions (
					account_id TEXT NOT NULL, workspace_id TEXT NOT NULL,
					version_id TEXT NOT NULL, file_id TEXT NOT NULL, path TEXT NOT NULL,
					content_hash TEXT, content_size INTEGER,
					blob_path TEXT, device_id TEXT NOT NULL,
					kind TEXT NOT NULL CHECK(kind IN ('content', 'rename', 'tombstone', 'restore')),
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
					uploaded_bytes INTEGER NOT NULL DEFAULT 0, object_key TEXT,
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
				CREATE TABLE IF NOT EXISTS local_heads (
					account_id TEXT NOT NULL, workspace_id TEXT NOT NULL,
					file_id TEXT NOT NULL, version_id TEXT NOT NULL,
					PRIMARY KEY(account_id, workspace_id, file_id, version_id)
				) STRICT;
				CREATE TABLE IF NOT EXISTS working_files (
					account_id TEXT NOT NULL, workspace_id TEXT NOT NULL,
					file_id TEXT NOT NULL, relative_path TEXT NOT NULL,
					content_hash TEXT, modified_ns TEXT, size_bytes INTEGER,
					PRIMARY KEY(account_id, workspace_id, file_id)
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
				CREATE TABLE IF NOT EXISTS workspace_roots (
					account_id TEXT NOT NULL, root_path TEXT NOT NULL, workspace_id TEXT NOT NULL,
					PRIMARY KEY(account_id, root_path), UNIQUE(account_id, workspace_id)
				) STRICT;
				CREATE TABLE IF NOT EXISTS local_files (
					account_id TEXT NOT NULL, workspace_id TEXT NOT NULL,
					file_id TEXT NOT NULL, relative_path TEXT NOT NULL,
					PRIMARY KEY(account_id, workspace_id, file_id),
					UNIQUE(account_id, workspace_id, relative_path)
				) STRICT;
				PRAGMA user_version = 1;
				COMMIT;
			`);
		}
		if (version < 2) {
			database.exec(`
				BEGIN IMMEDIATE;
				CREATE TABLE IF NOT EXISTS device_identity (
					id INTEGER PRIMARY KEY CHECK(id = 1), device_id TEXT NOT NULL
				) STRICT;
				CREATE TABLE IF NOT EXISTS legacy_storage_sources (
					source_path TEXT PRIMARY KEY, source_hash TEXT NOT NULL,
					settings_json TEXT NOT NULL, recorded_at TEXT NOT NULL
				) STRICT;
				PRAGMA user_version = 2;
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
