import { normalizeProviderId } from '../../../../shared/provider_types';
import { createBflImageAdapter } from './tti_bfl';
import { createGoogleImageAdapter } from './tti_google';
import { createIdeogramImageAdapter } from './tti_ideogram';
import { createLumaImageAdapter } from './tti_luma';
import { createOpenAIImageAdapter } from './tti_openai';
import { createQwenImageAdapter } from './tti_qwen';
import { createStabilityImageAdapter } from './tti_stability';
import { createXaiImageAdapter } from './tti_xai';
import { ImageProviderUnsupportedError } from './tti_errors';
import type { ImageAdapter, ImageProviderSpec } from './tti_types';

export function buildImageAdapter(provider: ImageProviderSpec): ImageAdapter {
	const id = normalizeProviderId(provider.id);
	const spec = { ...provider, id };
	if (id === 'black-forest-labs') return createBflImageAdapter(spec);
	if (id === 'google') return createGoogleImageAdapter(spec);
	if (id === 'ideogram') return createIdeogramImageAdapter(spec);
	if (id === 'luma') return createLumaImageAdapter(spec);
	if (id === 'openai') return createOpenAIImageAdapter(spec);
	if (id === 'qwen') return createQwenImageAdapter(spec);
	if (id === 'stability-ai') return createStabilityImageAdapter(spec);
	if (id === 'xai') return createXaiImageAdapter(spec);
	if (id === 'midjourney') {
		throw new ImageProviderUnsupportedError('Midjourney does not expose a public API.');
	}
	throw new ImageProviderUnsupportedError(`Text-to-image provider is not supported: ${id}`);
}
