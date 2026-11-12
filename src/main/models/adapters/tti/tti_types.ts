import type { ImageSource } from '../../../../shared/image_types';

export interface ImageProviderSpec {
	name: string;
	apiKey: string;
	baseURL: string;
}

export interface ImageAdapterGenerationRequest {
	modelId: string;
	prompt: string;
	endpoint?: string;
	promptField?: string;
	source?: ImageSource;
	options?: Record<string, unknown>;
	signal?: AbortSignal;
}

export interface ImageGenerationResult {
	base64: string;
	mimeType: string;
}

export interface ImageAdapter {
	generate(request: ImageAdapterGenerationRequest): Promise<ImageGenerationResult>;
}
