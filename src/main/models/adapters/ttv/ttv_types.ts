export interface VideoProviderSpec {
	name: string;
	apiKey: string;
	baseURL: string;
}

export interface VideoAdapterGenerationRequest {
	modelId: string;
	prompt: string;
	endpoint?: string;
	options?: Record<string, unknown>;
	signal?: AbortSignal;
}

export interface VideoGenerationResult {
	base64: string;
	mimeType: string;
}

export interface VideoAdapter {
	generate(request: VideoAdapterGenerationRequest): Promise<VideoGenerationResult>;
}
