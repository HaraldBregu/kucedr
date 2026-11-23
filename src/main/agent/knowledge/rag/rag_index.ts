import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { createRagMirror } from './mirror';
import { assertRagConsent } from './consent';
import { assertRagCurrent } from './current';
import { validateVector } from './validate';
import { ragRecipient } from './recipient';
import { purgeRagManifest } from './rag_manifest_purge';
import { isLocalRagDatabase } from '../../../../shared/rag_database';
import {
	KNOWLEDGE_MAX_RECORDS,
	KNOWLEDGE_MAX_VECTOR_VALUES,
	KNOWLEDGE_TIMEOUT_MS,
} from '../limits';
import { SelectedEmbeddingProvider } from './embedding';
import { normalizeRagIndexName } from './rag_index_name';
import { collectRagSources } from './source';
import { writeRagManifest } from './rag_manifest';
import { getRagConfiguration } from './rag_store';
import { chunkSpans } from './spans';
import { ragVectorStore } from './vector';
import type { RagIndexDependencies, RagIndexResult, VectorRecord } from './types';

const BATCH_SIZE = 64;

export async function indexRag(
	folders: readonly string[],
	indexName: string,
	dependencies: RagIndexDependencies = {}
): Promise<RagIndexResult> {
	const selectedIndexName = normalizeRagIndexName(indexName);
	const sources = [...new Set(folders.map((folder) => folder.trim()).filter(Boolean))];
	if (sources.length === 0) throw new Error('Choose at least one source folder before indexing.');

	const configuration = getRagConfiguration();
	if (!configuration.enabled) throw new Error('Enable Knowledge before indexing.');
	if (configuration.indexName !== selectedIndexName)
		throw new Error('Select the Knowledge index before indexing.');
	const providerId = configuration.embeddingProviderId.trim();
	const modelId = configuration.embeddingModelId.trim();
	if (!providerId || !modelId) {
		throw new Error('Select an embedding provider and model before indexing.');
	}
	assertRagConsent(configuration, providerId, modelId, selectedIndexName, true);
	const embeddingRecipient = ragRecipient(
		'embedding',
		providerId,
		modelId,
		selectedIndexName,
		configuration
	);

	const mirror = isLocalRagDatabase(configuration)
		? undefined
		: (dependencies.mirror ?? createRagMirror());
	const vectorStore = dependencies.vectors ?? ragVectorStore();
	const embeddingProvider = dependencies.embeddings ?? new SelectedEmbeddingProvider();
	const generation = `kucedr-${randomUUID()}`;
	const timeout = AbortSignal.timeout(KNOWLEDGE_TIMEOUT_MS);
	const signal = dependencies.signal ? AbortSignal.any([dependencies.signal, timeout]) : timeout;
	let uploadStarted = false;
	let published = false;
	let vectorValues = 0;
	const records: VectorRecord[] = [];
	const pending: Omit<VectorRecord, 'vector'>[] = [];
	const skipped: RagSkipped[] = [];
	let dimensions: number | undefined;
	let indexedFiles = 0;
	const result = (vectors: number): RagIndexResult => ({
		files: indexedFiles,
		vectors,
		skipped: skipped.length,
		skippedFiles: skipped.slice(0, SKIPPED_LISTED),
	});
	const embedBatch = async (batch: Omit<VectorRecord, 'vector'>[]): Promise<void> => {
		signal.throwIfAborted();
		assertRagConsent(configuration, providerId, modelId, selectedIndexName, true);
		assertRagCurrent(configuration);
		assertRagConsent(getRagConfiguration(), providerId, modelId, selectedIndexName, true);
		const embedded = await embeddingProvider.embed(
			{
				texts: batch.map((record) => record.text),
				inputType: 'document',
				providerId,
				modelId,
			},
			AbortSignal.any([signal, AbortSignal.timeout(KNOWLEDGE_REQUEST_TIMEOUT_MS)])
		);
		signal.throwIfAborted();
		if (embedded.providerId !== providerId || embedded.modelId !== modelId) {
			throw new Error('Embedding provider did not use the selected provider and model.');
		}
		vectorValues += embedded.embeddings.reduce((count, vector) => count + vector.length, 0);
		if (
			vectorValues > KNOWLEDGE_MAX_VECTOR_VALUES ||
			embedded.dimensions < 1 ||
			embedded.dimensions > 65_536 ||
			embedded.embeddings.length !== batch.length ||
			embedded.embeddings.some(
				(vector) =>
					vector.length !== embedded.dimensions ||
					vector.some((value) => !Number.isFinite(value))
			)
		)
			throw new Error('Invalid or excessive embedding vectors.');
		dimensions ??= embedded.dimensions;
		if (embedded.dimensions !== dimensions) {
			throw new Error('Embedding dimensions changed while indexing.');
		}
		for (const vector of embedded.embeddings) validateVector(vector, dimensions);
		for (const [offset, record] of batch.entries())
			records.push({ ...record, vector: embedded.embeddings[offset] });
	};
	const fits = (count: number, width = dimensions): boolean => {
		const planned = records.length + pending.length + count;
		return planned <= KNOWLEDGE_MAX_RECORDS && (!width || planned * width <= KNOWLEDGE_MAX_VECTOR_VALUES);
	};

	try {
		for await (const { source, file, segments } of collectRagSources(
			sources,
			skipped,
			signal,
			dependencies.progress
		)) {
			signal.throwIfAborted();
			const shown = path.join(path.basename(source), file);
			const chunks = segments.flatMap((segment) =>
				chunkSpans(segment.text).map((chunk) => ({
					...chunk,
					text: `${shown}${segment.label ? ` · ${segment.label}` : ''}\n\n${chunk.text}`,
				}))
			);
			if (chunks.length === 0) continue;
			const sourceId = createHash('sha256')
				.update(path.resolve(source))
				.update('\0')
				.update(file)
				.digest('hex');
			const sourceFingerprint = createHash('sha256')
				.update('knowledge-chunks-v4\0')
				.update(embeddingRecipient)
				.update('\0')
				.update(shown)
				.update('\0')
				.update(JSON.stringify(segments))
				.digest('hex');
			const reused = vectorStore.getReusableSource(
				selectedIndexName,
				sourceId,
				sourceFingerprint,
				providerId,
				modelId
			);
			if (reused) {
				for (const record of reused) {
					validateVector(record.vector, dimensions ?? reused[0].vector.length);
				}
				if (!fits(reused.length, dimensions ?? reused[0].vector.length)) {
					skipped.push({ path: shown, reason: 'limit' });
					continue;
				}
				vectorValues += reused.reduce((count, record) => count + record.vector.length, 0);
				dimensions ??= reused[0].vector.length;
				records.push(...reused);
				indexedFiles += 1;
				continue;
			}
			if (!fits(chunks.length)) {
				skipped.push({ path: shown, reason: 'limit' });
				continue;
			}
			indexedFiles += 1;
			for (const [chunkIndex, chunk] of chunks.entries())
				pending.push({
					id: `${sourceId}#${chunkIndex}`,
					sourceId,
					sourceFingerprint,
					path: shown,
					chunkIndex,
					lineStart: chunk.lineStart,
					lineEnd: chunk.lineEnd,
					text: chunk.text,
					checksum: createHash('sha256').update(chunk.text).digest('hex'),
					indexedAt: new Date().toISOString(),
				});
			while (pending.length >= BATCH_SIZE) await embedBatch(pending.splice(0, BATCH_SIZE));
		}
		if (pending.length > 0) await embedBatch(pending.splice(0));

		if (!dimensions || records.length === 0) {
			signal.throwIfAborted();
			assertRagCurrent(configuration);
			assertRagConsent(getRagConfiguration(), providerId, modelId, selectedIndexName, true);
			vectorStore.purge(selectedIndexName);
			purgeRagManifest(selectedIndexName);
			return result(0);
		}
		signal.throwIfAborted();

		assertRagConsent(configuration, providerId, modelId, selectedIndexName, true);
		assertRagCurrent(configuration);
		assertRagConsent(getRagConfiguration(), providerId, modelId, selectedIndexName, true);
		if (mirror) {
			uploadStarted = true;
			await mirror.upload(selectedIndexName, generation, dimensions, records, signal);
		}
		signal.throwIfAborted();
		assertRagConsent(configuration, providerId, modelId, selectedIndexName, true);
		assertRagCurrent(configuration);
		assertRagConsent(getRagConfiguration(), providerId, modelId, selectedIndexName, true);

		const completedAt = new Date().toISOString();
		vectorStore.publish({
			indexName: selectedIndexName,
			generation,
			providerId,
			modelId,
			dimensions,
			completedAt,
			records,
		});
		published = true;
		writeRagManifest({
			indexName: selectedIndexName,
			activeNamespace: generation,
			providerId,
			modelId,
			dimensions,
			completedAt,
			embeddingRecipient,
			folders: [...sources],
		});
		return { files: indexedFiles, vectors: records.length };
	} catch (error) {
		if (mirror && uploadStarted && !published) {
			try {
				await mirror.discard(selectedIndexName, generation, AbortSignal.timeout(15_000));
			} catch (cleanupError) {
				throw new AggregateError(
					[error, cleanupError],
					'RAG indexing failed; its staging namespace cleanup also failed: ' + generation,
					{ cause: cleanupError }
				);
			}
		}
		throw error;
	} finally {
		if (!dependencies.vectors) vectorStore.close();
	}
}
