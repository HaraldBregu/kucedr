import { readFileBoundedSync } from '../../files/read_sync';
import { knowledgeRoot } from '../root';
import { randomUUID } from 'node:crypto';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { userDataLocation } from '../../../shared/user_data_location';
import type { RagManifest } from './types';
import { normalizeRagIndexName } from './rag_index_name';

function manifestPath(): string {
	return path.join(userDataLocation(), 'rag', 'index.json');
}

export function readRagManifest(indexName?: string): RagManifest | undefined {
	const files = indexName ? [`index-${normalizeRagIndexName(indexName)}.json`, 'index.json'] : ['index.json'];
	for (const file of files) {
		try {
			const manifest = JSON.parse(readFileBoundedSync(
				path.join(knowledgeRoot(path.dirname(manifestPath())), file), 64 * 1024
			).content.toString('utf8')) as RagManifest;
			if (!indexName || manifest.indexName === indexName) return manifest;
		} catch {}
	}
	return undefined;
}

export function writeRagManifest(manifest: RagManifest): void {
	const directory = path.dirname(manifestPath());
	mkdirSync(directory, { recursive: true, mode: 0o700 });
	for (const file of [path.join(directory, `index-${normalizeRagIndexName(manifest.indexName)}.json`), manifestPath()]) {
		const temporaryFile = `${file}.${randomUUID()}.tmp`;
		try {
			writeFileSync(temporaryFile, JSON.stringify(manifest), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
			renameSync(temporaryFile, file);
		} finally {
			rmSync(temporaryFile, { force: true });
		}
	}
}
