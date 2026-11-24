import { getRagConfiguration } from './rag_store';
import { ragVectorStore } from './vector';
import type { VectorChunk, VectorStore } from './types';

export function aroundRag(chunkId: string, span = 2, vectors?: VectorStore): VectorChunk[] {
	const configuration = getRagConfiguration();
	if (!configuration.enabled) throw new Error('Enable Knowledge before reading it.');
	const store = vectors ?? ragVectorStore();
	try {
		return store.around(configuration.indexName, chunkId, span);
	} finally {
		if (!vectors) store.close();
	}
}
