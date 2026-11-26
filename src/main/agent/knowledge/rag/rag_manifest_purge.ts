import { rmSync } from 'node:fs';
import path from 'node:path';
import { ragLocation } from './rag_location';
import { readRagManifest } from './rag_manifest';
import { normalizeRagIndexName } from './rag_index_name';

export function purgeRagManifest(indexName: string, generation?: string): boolean {
	const manifest = readRagManifest(indexName);
	if (
		!manifest ||
		manifest.indexName !== indexName ||
		(generation && manifest.activeNamespace !== generation)
	) {
		return false;
	}
	if (manifest.artifactFile && path.basename(manifest.artifactFile) === manifest.artifactFile) {
		rmSync(path.join(ragLocation(), manifest.artifactFile), { force: true });
	}
	rmSync(path.join(ragLocation(), `index-${normalizeRagIndexName(indexName)}.json`), {
		force: true,
	});
	if (readRagManifest()?.indexName === indexName)
		rmSync(path.join(ragLocation(), 'index.json'), { force: true });
	return true;
}
