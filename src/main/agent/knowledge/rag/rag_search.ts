import { assertRagConsent } from './consent';
import { getRagConfiguration } from './rag_store';
import { containsSecret } from '../secrets';
import { DEFAULT_RAG_INDEX_NAME } from '../../../../shared/rag_types';
import { SelectedEmbeddingProvider } from './embedding';
import { normalizeRagIndexName } from './rag_index_name';
import { ragVectorStore } from './vector';
import { validateVector } from './validate';
import type { RagMatch, RagSearchDependencies } from './types';

export async function searchRag(
	query: string,
	indexName: string,
	topK = 5,
	dependencies: RagSearchDependencies = {}
): Promise<RagMatch[]> {
	const selectedIndexName = normalizeRagIndexName(indexName);
	const configuration = getRagConfiguration();
	if (!configuration.enabled) throw new Error('Enable Knowledge before searching.');
	if (configuration.indexName !== selectedIndexName)
		throw new Error('Select the Knowledge index before searching.');
	const text = query.trim();
	if (!text || text.length > 16_000 || containsSecret(text))
		throw new Error('Query is empty, oversized or contains credential-like content.');
	if (!Number.isInteger(topK) || topK < 1 || topK > 100)
		throw new Error('Knowledge result count must be between 1 and 100.');
	const vectorStore = dependencies.vectors ?? ragVectorStore();
	const embeddingProvider = dependencies.embeddings ?? new SelectedEmbeddingProvider();

	try {
		dependencies.signal?.throwIfAborted();
		const index = vectorStore.getIndex(selectedIndexName);
		if (!index) throw new Error('Index the rag folder before searching.');
		if ((index.indexName ?? DEFAULT_RAG_INDEX_NAME) !== selectedIndexName) {
			throw new Error('Generate the selected RAG index before searching.');
		}

		if (
			configuration.embeddingProviderId !== index.providerId ||
			configuration.embeddingModelId !== index.modelId
		)
			throw new Error('The embedding model changed. Rebuild the selected Knowledge index before searching.');
		assertRagConsent(configuration, index.providerId, index.modelId, selectedIndexName);
		const embedded = await embeddingProvider.embed(
			{
				texts: [text],
				inputType: 'query',
				providerId: index.providerId,
				modelId: index.modelId,
			},
			dependencies.signal
		);
		dependencies.signal?.throwIfAborted();
		if (embedded.providerId !== index.providerId || embedded.modelId !== index.modelId) {
			throw new Error('Embedding provider did not use the indexed provider and model.');
		}
		if (embedded.embeddings.length !== 1 || embedded.dimensions !== index.dimensions)
			throw new Error('Query embedding dimensions do not match the selected Knowledge index.');
		validateVector(embedded.embeddings[0], index.dimensions);
		const current = getRagConfiguration();
		if (!current.enabled || current.indexName !== selectedIndexName ||
			current.embeddingProviderId !== index.providerId || current.embeddingModelId !== index.modelId)
			throw new Error('Knowledge settings changed while searching. Try again.');
		assertRagConsent(current, index.providerId, index.modelId, selectedIndexName);

		return vectorStore.search(selectedIndexName, embedded.embeddings[0], topK)
			.filter((match) => Number.isFinite(match.score) && match.score > (current.minimumScore ?? 0))
			.map((match) => ({
			sourceId: match.sourceId,
			chunkId: match.id,
			path: match.path,
			lineStart: match.lineStart,
			lineEnd: match.lineEnd,
			checksum: match.checksum,
			indexedAt: match.indexedAt,
			text: match.text,
			score: match.score,
		}));
	} finally {
		if (!dependencies.vectors) vectorStore.close();
	}
}
