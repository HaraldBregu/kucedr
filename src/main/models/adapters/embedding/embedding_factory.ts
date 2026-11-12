import type { CatalogModel } from '../../../../shared/model_types';
import { createBatchEmbedContentsAdapter } from './batch_embed_contents';
import { createEmbedTextAdapter } from './embed_text';
import { createEmbedTypesAdapter } from './embed_types';
import { createEmbeddingsAdapter } from './embeddings';
import { createEmbeddingsInputTypeAdapter } from './embeddings_input_type';
import { createEmbeddingsTaskAdapter } from './embeddings_task';
import type { EmbeddingAdapter, EmbeddingProviderSpec } from './embedding_types';

export interface EmbeddingProtocol {
	create(spec: EmbeddingProviderSpec): EmbeddingAdapter;
	inputField: string;
}

const PROTOCOLS: Record<string, EmbeddingProtocol> = {
	embeddings: { create: createEmbeddingsAdapter, inputField: 'input' },
	'embeddings-task': { create: createEmbeddingsTaskAdapter, inputField: 'input' },
	'embeddings-input-type': { create: createEmbeddingsInputTypeAdapter, inputField: 'input' },
	'embed-types': { create: createEmbedTypesAdapter, inputField: 'texts' },
	'embed-text': { create: createEmbedTextAdapter, inputField: 'texts' },
	'batch-embed-contents': { create: createBatchEmbedContentsAdapter, inputField: 'requests' },
};

export function embeddingProtocol(model: CatalogModel): EmbeddingProtocol {
	const protocol = model.metadata?.protocol;
	const entry = protocol && Object.hasOwn(PROTOCOLS, protocol) ? PROTOCOLS[protocol] : undefined;
	if (!entry) throw new Error(`${model.name} (${model.provider.name}) declares no supported protocol.`);
	return entry;
}
