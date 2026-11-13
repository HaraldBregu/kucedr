export interface MusicProviderSpec {
	name: string;
	apiKey: string;
	baseURL: string;
	protocol?: string;
}

export interface MusicAdapterGenerationRequest {
	modelId: string;
	prompt: string;
	endpoint?: string;
	options?: Record<string, unknown>;
	signal?: AbortSignal;
}

export interface MusicGenerationResult {
	base64: string;
	mimeType: string;
}

export interface MusicAdapter {
	generate(request: MusicAdapterGenerationRequest): Promise<MusicGenerationResult>;
}
