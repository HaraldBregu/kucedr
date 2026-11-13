import type { CatalogModel } from '../../../../shared/model_types';
import { buildMusicAdapter } from './tta_factory';
import type { MusicGenerationResult } from './tta_types';

export interface GenerateMusicOptions {
	model: CatalogModel;
	apiKey: string;
	prompt: string;
	options?: Record<string, unknown>;
	signal?: AbortSignal;
}

export async function generateMusic(options: GenerateMusicOptions): Promise<MusicGenerationResult> {
	const { model } = options;
	const metadata = model.metadata;
	const adapter = buildMusicAdapter(
		{
			name: model.provider.name,
			apiKey: options.apiKey,
			baseURL: model.url ?? '',
			protocol: metadata?.protocol,
		},
		model.name
	);
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
