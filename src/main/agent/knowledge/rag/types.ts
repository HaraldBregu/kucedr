import type { EmbeddingResult } from '../../../../shared/embedding_types';

export interface EmbeddingInput {
	texts: string[];
	inputType: 'document' | 'query';
	providerId: string;
	modelId: string;
}

export interface EmbeddingProvider {
	embed(input: EmbeddingInput, signal?: AbortSignal): Promise<EmbeddingResult>;
}

export interface RagArtifactRecord {
	id: string;
	values: number[];
	metadata: { path: string; text: string };
}

export interface RagArtifact {
	indexName: string;
	activeNamespace: string;
	providerId: string;
	modelId: string;
	dimensions: number;
	records: RagArtifactRecord[];
}

export interface RagChunkSpan {
	text: string;
	lineStart: number;
	lineEnd: number;
}

export interface RagIndexDependencies {
	embeddings?: EmbeddingProvider;
	vectors?: VectorStore;
	mirror?: RagMirror;
	signal?: AbortSignal;
}

export interface RagIndexResult {
	files: number;
	vectors: number;
}

export interface RagManifest {
	indexName: string;
	activeNamespace: string;
	artifactFile?: string;
	providerId: string;
	modelId: string;
	dimensions: number;
	completedAt: string;
	embeddingRecipient?: string;
	folders?: string[];
}

export interface RagMatch {
	sourceId: string;
	chunkId: string;
	path: string;
	lineStart: number;
	lineEnd: number;
	checksum: string;
	indexedAt: string;
	text: string;
	score: number;
}

export interface RagScheduleLogger {
	info(source: string, message: string, data?: unknown): void;
	error(source: string, message: string, data?: unknown): void;
}

export interface RagSearchDependencies {
	embeddings?: EmbeddingProvider;
	vectors?: VectorStore;
	signal?: AbortSignal;
}

export interface RagSource {
	readonly source: string;
	readonly sourceIndex: number;
	readonly file: string;
	readonly content: string;
}

export interface VectorIndex {
	indexName: string;
	generation: string;
	providerId: string;
	modelId: string;
	dimensions: number;
	completedAt: string;
}

export interface VectorRecord {
	id: string;
	sourceId: string;
	sourceFingerprint: string;
	path: string;
	chunkIndex: number;
	lineStart: number;
	lineEnd: number;
	text: string;
	checksum: string;
	indexedAt: string;
	vector: number[];
}

export interface VectorMatch extends VectorRecord {
	score: number;
}

export interface VectorPublication extends VectorIndex {
	records: readonly VectorRecord[];
}

export interface VectorStore {
	getIndex(indexName: string): VectorIndex | undefined;
	getReusableSource(
		indexName: string,
		sourceId: string,
		sourceFingerprint: string,
		providerId: string,
		modelId: string
	): VectorRecord[] | undefined;
	publish(publication: VectorPublication): void;
	search(indexName: string, vector: readonly number[], topK: number): VectorMatch[];
	exportIndex(indexName: string, generation?: string): VectorPublication | undefined;
	purge(indexName: string, generation?: string): { records: number; indexRemoved: boolean };
	close(): void;
}

export interface IndexRow {
	index_name: string;
	active_generation: string;
	provider_id: string;
	model_id: string;
	dimensions: number;
	completed_at: string;
}

export interface RecordRow {
	id: string;
	source_id: string;
	source_fingerprint: string;
	path: string;
	chunk_index: number;
	line_start: number;
	line_end: number;
	text: string;
	checksum: string;
	indexed_at: string;
	vector: Uint8Array;
}

export interface RagMirror {
	upload(
		indexName: string,
		generation: string,
		dimensions: number,
		records: readonly VectorRecord[],
		signal?: AbortSignal
	): Promise<void>;
	discard(indexName: string, generation: string, signal?: AbortSignal): Promise<void>;
}
