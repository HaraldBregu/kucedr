import { buildImageAdapter } from './tti_factory';
import { ImageProviderUnsupportedError } from './tti_errors';
import type { CatalogModel } from '../../../../shared/model_types';
import type { ImageSource } from '../../../../shared/image_types';
import type { ImageGenerationResult } from './tti_types';

export interface GenerateImageOptions {
	model: CatalogModel;
	apiKey: string;
	prompt: string;
	source?: ImageSource;
	options?: Record<string, unknown>;
	signal?: AbortSignal;
}

export async function generateImage(options: GenerateImageOptions): Promise<ImageGenerationResult> {
	const { model } = options;
	const metadata = model.metadata;
	const adapter = buildImageAdapter(metadata?.protocol, model.name, {
		name: model.provider.name,
		apiKey: options.apiKey,
		baseURL: model.url ?? '',
	});
	if (options.source && !metadata?.promptAttachments?.some((rule) => rule.kind === 'image')) {
		throw new ImageProviderUnsupportedError(`${model.name} does not support source-image editing.`);
	}
	const modelId = metadata?.apiModelId ?? model.id;
	const merged = { ...metadata?.requestDefaults, ...options.options };
	return adapter.generate({
		modelId,
		prompt: options.prompt,
		endpoint: metadata?.endpoint?.replaceAll('{model}', modelId),
		promptField: metadata?.promptField,
		source: options.source,
		options: Object.keys(merged).length > 0 ? merged : undefined,
		signal: options.signal,
	});
}
