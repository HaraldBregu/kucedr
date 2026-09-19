import fs from 'node:fs/promises';
import path from 'node:path';
import { memoryPath } from './path';
import { snapshotSource } from './snapshot_source';
import type { SourceSession } from './types';

export async function scanSources(root = path.dirname(memoryPath())): Promise<SourceSession[]> {
	const entries = await fs
		.readdir(root, { withFileTypes: true })
		.catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return [];
			throw error;
		});
	const sources: SourceSession[] = [];
	for (const entry of entries) {
		const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.md$/i.exec(
			entry.name
		);
		if (!entry.isFile() || !match) continue;
		const id = match[1].toLowerCase();
		sources.push(snapshotSource(id, await fs.readFile(path.join(root, entry.name), 'utf8')));
	}
	return sources.sort((left, right) => left.id.localeCompare(right.id));
}
