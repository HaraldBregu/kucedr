import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// The other browser keeps its database locked while it runs, and Kucedr must never write
// to it, so every read works on a private copy that is deleted afterwards.
export function withCopy<Result>(file: string, read: (database: DatabaseSync) => Result): Result {
	const directory = mkdtempSync(path.join(os.tmpdir(), 'kucedr-import-'));
	try {
		const copy = path.join(directory, 'copy.sqlite');
		copyFileSync(file, copy);
		if (existsSync(`${file}-wal`)) copyFileSync(`${file}-wal`, `${copy}-wal`);
		const database = new DatabaseSync(copy);
		try {
			return read(database);
		} finally {
			database.close();
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}
