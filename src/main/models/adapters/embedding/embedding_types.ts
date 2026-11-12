import type { ModelMetadata } from '../../../../shared/model_types';

export interface EmbeddingProviderSpec {
	name: string;
	apiKey: string;
	model: string;
	baseURL: string;
	metadata?: ModelMetadata;
}

export interface EmbeddingAdapterRequest {
	texts: string[];
	inputType: 'document' | 'query';
	signal?: AbortSignal;
}

export interface EmbeddingAdapter {
	embed(request: EmbeddingAdapterRequest): Promise<number[][]>;
}
