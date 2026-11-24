import { assertRagConsent } from './consent';
import { getRagConfiguration } from './rag_store';
import { containsSecret } from '../secrets';
import { DEFAULT_RAG_INDEX_NAME } from '../../../../shared/rag_types';
import { SelectedEmbeddingProvider } from './embedding';
import { normalizeRagIndexName } from './rag_index_name';
import { ragVectorStore } from './vector';
import { validateVector } from './validate';
import { readRagManifest } from './rag_manifest';
import { ragRecipient } from './recipient';
import { assertRagCurrent } from './current';
import type { RagMatch, RagSearchDependencies, VectorHit } from './types';

const CANDIDATES = 50;
const FUSION = 60;
const CACHED = 256;
const cache = new Map<string, number[]>();

export async function searchRag(
	query: string | readonly string[],
	indexName: string,
	topK = 5,
	dependencies: RagSearchDependencies = {}
): Promise<RagMatch[]> {
	const selectedIndexName = normalizeRagIndexName(indexName);
	const configuration = getRagConfiguration();
	if (!configuration.enabled) throw new Error('Enable Knowledge before searching.');
	if (configuration.indexName !== selectedIndexName)
		throw new Error('Select the Knowledge index before searching.');
	const texts = [
		...new Set((typeof query === 'string' ? [query] : query).map((text) => text.trim())),
	];
	if (
		texts.length === 0 ||
		texts.length > 3 ||
		texts.some((text) => !text || text.length > 16_000 || containsSecret(text))
	)
		throw new Error('Query is empty, oversized or contains credential-like content.');
	if (!Number.isInteger(topK) || topK < 1 || topK > 100)
		throw new Error('Knowledge result count must be between 1 and 100.');
	const vectorStore = dependencies.vectors ?? ragVectorStore();
	const embeddingProvider = dependencies.embeddings ?? new SelectedEmbeddingProvider();
	const timeout = AbortSignal.timeout(30_000);
	const signal = dependencies.signal ? AbortSignal.any([dependencies.signal, timeout]) : timeout;

	try {
		signal.throwIfAborted();
		const index = vectorStore.getIndex(selectedIndexName);
		if (!index) return [];
		if ((index.indexName ?? DEFAULT_RAG_INDEX_NAME) !== selectedIndexName) {
			throw new Error('Generate the selected Knowledge index before searching.');
		}

		if (
			configuration.embeddingProviderId !== index.providerId ||
			configuration.embeddingModelId !== index.modelId
		)
			throw new Error(
				'The embedding model changed. Rebuild the selected Knowledge index before searching.'
			);
		assertRagConsent(configuration, index.providerId, index.modelId, selectedIndexName);
		const manifest = readRagManifest(selectedIndexName);
		if (
			manifest?.activeNamespace === index.generation &&
			((manifest.embeddingRecipient &&
				manifest.embeddingRecipient !==
					ragRecipient(
						'embedding',
						index.providerId,
						index.modelId,
						selectedIndexName,
						configuration
					)) ||
				(manifest.folders &&
					JSON.stringify(manifest.folders) !== JSON.stringify(configuration.folders)))
		)
			throw new Error(
				'The embedding service or source folders changed. Rebuild the Knowledge index before searching.'
			);
		const key = (text: string): string => `${index.providerId}\0${index.modelId}\0${text}`;
		const missing = texts.filter((text) => !cache.has(key(text)));
		const embedding =
			missing.length > 0
				? embeddingProvider.embed(
						{
							texts: missing,
							inputType: 'query',
							providerId: index.providerId,
							modelId: index.modelId,
						},
						signal
					)
				: undefined;
		embedding?.catch(() => undefined);
		const keywords = texts.map((text) =>
			vectorStore.keyword(selectedIndexName, text, CANDIDATES)
		);
		const embedded = await embedding;
		signal.throwIfAborted();
		if (embedded) {
			if (embedded.providerId !== index.providerId || embedded.modelId !== index.modelId) {
				throw new Error('Embedding provider did not use the indexed provider and model.');
			}
			if (embedded.embeddings.length !== missing.length || embedded.dimensions !== index.dimensions)
				throw new Error('Query embedding dimensions do not match the selected Knowledge index.');
			for (const [offset, text] of missing.entries()) {
				validateVector(embedded.embeddings[offset], index.dimensions);
				cache.set(key(text), embedded.embeddings[offset]);
				if (cache.size > CACHED) cache.delete(cache.keys().next().value as string);
			}
		}
		const current = getRagConfiguration();
		assertRagCurrent(configuration);
		if (
			!current.enabled ||
			current.indexName !== selectedIndexName ||
			current.embeddingProviderId !== index.providerId ||
			current.embeddingModelId !== index.modelId
		)
			throw new Error('Knowledge settings changed while searching. Try again.');
		assertRagConsent(current, index.providerId, index.modelId, selectedIndexName);

		const scan = dependencies.vectors ? undefined : (await import('./scan')).scanRag;
		const ranked = await Promise.all(
			texts.map(async (text): Promise<VectorHit[]> => {
				const vector = cache.get(key(text)) as number[];
				return scan
					? scan(selectedIndexName, vector, CANDIDATES, signal)
					: vectorStore.search(selectedIndexName, vector, CANDIDATES);
			})
		);
		signal.throwIfAborted();
		const fused = new Map<string, number>();
		const add = (ids: readonly string[]): void => {
			for (const [rank, id] of ids.entries())
				fused.set(id, (fused.get(id) ?? 0) + 1 / (FUSION + rank + 1));
		};
		for (const hits of ranked)
			add(
				hits
					.filter(
						(hit) =>
							Number.isFinite(hit.score) &&
							hit.score > 0 &&
							hit.score >= (current.minimumScore ?? 0)
					)
					.map((hit) => hit.id)
			);
		for (const ids of keywords) add(ids);
		const top = [...fused]
			.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
			.slice(0, topK);
		const scores = new Map(top);
		return vectorStore.chunks(selectedIndexName, top.map(([id]) => id)).map((chunk) => ({
			sourceId: chunk.sourceId,
			chunkId: chunk.id,
			path: chunk.path,
			lineStart: chunk.lineStart,
			lineEnd: chunk.lineEnd,
			checksum: chunk.checksum,
			indexedAt: chunk.indexedAt,
			text: chunk.text,
			score: scores.get(chunk.id) ?? 0,
		}));
	} finally {
		if (!dependencies.vectors) vectorStore.close();
	}
}
