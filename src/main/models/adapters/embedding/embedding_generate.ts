import { buildEmbeddingAdapter } from './embedding_factory';
import { validateEmbeddingVectors } from './validate';

const BATCH_SIZE = 64;

export interface GenerateEmbeddingsOptions {
	providerId: string;
	apiKey: string;
	modelId: string;
	baseURL: string;
	texts: string[];
	inputType?: 'document' | 'query';
	signal?: AbortSignal;
}

export async function generateEmbeddings(options: GenerateEmbeddingsOptions): Promise<number[][]> {
	const adapter = buildEmbeddingAdapter({
		id: options.providerId,
		name: options.providerId,
		apiKey: options.apiKey,
		model: options.modelId,
		baseURL: options.baseURL,
	});
	const embeddings: number[][] = [];
	let dimensions: number | undefined;
	for (let start = 0; start < options.texts.length; start += BATCH_SIZE) {
		options.signal?.throwIfAborted();
		const texts = options.texts.slice(start, start + BATCH_SIZE);
		const batch = await adapter.embed({
			texts,
			inputType: options.inputType ?? 'document',
			signal: options.signal,
		});
		options.signal?.throwIfAborted();
		const batchDimensions = validateEmbeddingVectors(batch, texts.length, options.providerId);
		dimensions ??= batchDimensions;
		if (dimensions !== batchDimensions) {
			throw new Error('Embedding dimensions changed between batches.');
		}
		embeddings.push(...batch);
	}
	return embeddings;
}
