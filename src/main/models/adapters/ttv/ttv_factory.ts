import { createZaiVideoAdapter } from './ttv_zai';
import { normalizeProviderId } from '../../../../shared/provider_types';
import { createBflVideoAdapter } from './ttv_bfl';
import { createGoogleVideoAdapter } from './ttv_google';
import { createKlingVideoAdapter } from './ttv_kling';
import { createLumaVideoAdapter } from './ttv_luma';
import { createMinimaxVideoAdapter } from './ttv_minimax';
import { createPikaVideoAdapter } from './ttv_pika';
import { createQwenVideoAdapter } from './ttv_qwen';
import { createRunwayVideoAdapter } from './ttv_runway';
import { createXaiVideoAdapter } from './ttv_xai';
import { VideoProviderUnsupportedError } from './ttv_errors';
import type { VideoAdapter, VideoProviderSpec } from './ttv_types';

export function buildVideoAdapter(provider: VideoProviderSpec): VideoAdapter {
	const id = normalizeProviderId(provider.id);
	const spec = { ...provider, id };
	if (id === 'black-forest-labs') return createBflVideoAdapter(spec);
	if (id === 'google') return createGoogleVideoAdapter(spec);
	if (id === 'kling') return createKlingVideoAdapter(spec);
	if (id === 'luma') return createLumaVideoAdapter(spec);
	if (id === 'minimax') return createMinimaxVideoAdapter(spec);
	if (id === 'pika') return createPikaVideoAdapter(spec);
	if (id === 'qwen') return createQwenVideoAdapter(spec);
	if (id === 'runway') return createRunwayVideoAdapter(spec);
	if (id === 'zai') return createZaiVideoAdapter(spec);
	if (id === 'xai') return createXaiVideoAdapter(spec);
	if (id === 'midjourney') {
		throw new VideoProviderUnsupportedError('Midjourney does not expose a public API.');
	}
	throw new VideoProviderUnsupportedError(`Text-to-video provider is not supported: ${id}`);
}
