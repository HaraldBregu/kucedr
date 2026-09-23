import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

export function getOrCreateWorkspaceId(
	database: DatabaseSync,
	accountId: string,
	rootPath: string,
	sharedWorkspaceId: string
): string {
	if (!accountId || !sharedWorkspaceId || !path.isAbsolute(rootPath)) {
		throw new Error('Invalid workspace identity.');
	}
	const normalized = path.resolve(rootPath);
	const existing = database.prepare(`SELECT workspace_id FROM workspace_roots
		WHERE account_id = ? AND root_path = ?`).get(accountId, normalized) as
		| { workspace_id: string }
		| undefined;
	if (existing) {
		if (existing.workspace_id !== sharedWorkspaceId) {
			throw new Error('Workspace root is already paired with another workspace.');
		}
		return existing.workspace_id;
	}
	database.prepare(`INSERT OR IGNORE INTO workspace_roots
		(account_id, root_path, workspace_id) VALUES (?, ?, ?)`)
		.run(accountId, normalized, sharedWorkspaceId);
	return (database.prepare(`SELECT workspace_id FROM workspace_roots
		WHERE account_id = ? AND root_path = ?`).get(accountId, normalized) as { workspace_id: string })
		.workspace_id;
}
