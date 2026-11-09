import fs from 'node:fs/promises';
import path from 'node:path';
import { isUuid } from '../agent/session/session_is_uuid';
import { memoryPath } from './path';
import { snapshotSource } from './snapshot_source';
import type { SourceSession } from './types';

export async function scanSources(
	root = path.dirname(memoryPath()),
	sessionId?: string
): Promise<SourceSession[]> {
	const entries = await fs
		.readdir(root, { withFileTypes: true })
		.catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return [];
			throw error;
		});
	const sources: SourceSession[] = [];
	for (const entry of entries) {
		const id = entry.name.slice(0, -3).toLowerCase();
		if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md') || !isUuid(id)) continue;
		if (sessionId && id !== sessionId) continue;
		sources.push(snapshotSource(id, await fs.readFile(path.join(root, entry.name), 'utf8')));
	}
	return sources.sort(
		(left, right) =>
			(left.updatedAt ?? '').localeCompare(right.updatedAt ?? '') || left.id.localeCompare(right.id)
	);
}
