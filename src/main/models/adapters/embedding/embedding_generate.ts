import type { CatalogModel } from '../../../../shared/model_types';
import { embeddingProtocol } from './embedding_factory';
import { validateEmbeddingVectors } from './validate';

const BATCH_SIZE = 64;

export interface GenerateEmbeddingsOptions {
	model: CatalogModel;
	apiKey: string;
	baseURL: string;
	texts: string[];
	inputType?: 'document' | 'query';
	signal?: AbortSignal;
}

export async function generateEmbeddings(options: GenerateEmbeddingsOptions): Promise<number[][]> {
	const { model } = options;
	const protocol = embeddingProtocol(model);
	const adapter = protocol.create({
		name: model.provider.name,
		apiKey: options.apiKey,
		model: model.id,
		baseURL: options.baseURL,
		metadata: model.metadata,
	});
	const inputType = options.inputType ?? 'document';
	const template = model.metadata?.inputTemplates?.[inputType];
	const inputs = template
		? options.texts.map((text) => template.split('{text}').join(text))
		: options.texts;
	const embeddings: number[][] = [];
	const batchSize = model.metadata?.inputs?.[protocol.inputField]?.maxItems ?? BATCH_SIZE;
	let dimensions: number | undefined;
	for (let start = 0; start < inputs.length; start += batchSize) {
		options.signal?.throwIfAborted();
		const texts = inputs.slice(start, start + batchSize);
		const batch = await adapter.embed({ texts, inputType, signal: options.signal });
		options.signal?.throwIfAborted();
		const batchDimensions = validateEmbeddingVectors(batch, texts.length, model.provider.name);
		dimensions ??= batchDimensions;
		if (dimensions !== batchDimensions) {
			throw new Error('Embedding dimensions changed between batches.');
		}
		embeddings.push(...batch);
	}
	return embeddings;
}
