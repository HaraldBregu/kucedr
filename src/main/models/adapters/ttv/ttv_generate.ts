import { buildVideoAdapter } from './ttv_factory';
import type { CatalogModel } from '../../../../shared/model_types';
import type { VideoGenerationResult } from './ttv_types';

export interface GenerateVideoOptions {
	model: CatalogModel;
	apiKey: string;
	prompt: string;
	options?: Record<string, unknown>;
	signal?: AbortSignal;
}

export async function generateVideo(options: GenerateVideoOptions): Promise<VideoGenerationResult> {
	const { model } = options;
	const metadata = model.metadata;
	const adapter = buildVideoAdapter(metadata?.protocol, model.name, {
		name: model.provider.name,
		apiKey: options.apiKey,
		baseURL: model.url ?? '',
	});
	const modelId = metadata?.apiModelId ?? model.id;
	const merged = { ...metadata?.requestDefaults, ...options.options };
	return adapter.generate({
		modelId,
		prompt: options.prompt,
		endpoint: metadata?.endpoint?.replaceAll('{model}', modelId),
		options: Object.keys(merged).length > 0 ? merged : undefined,
		signal: options.signal,
	});
}
