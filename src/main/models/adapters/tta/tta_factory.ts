import { normalizeProviderId } from '../../../../shared/provider_types';
import { createElevenLabsMusicAdapter } from './tta_elevenlabs';
import { createGoogleMusicAdapter } from './tta_google';
import { createMiniMaxMusicAdapter } from './tta_minimax';
import { createPikaMusicAdapter } from './tta_pika';
import { createStabilityMusicAdapter } from './tta_stability';
import { MusicProviderUnsupportedError } from './tta_errors';
import type { MusicAdapter, MusicProviderSpec } from './tta_types';

export function buildMusicAdapter(provider: MusicProviderSpec): MusicAdapter {
	const id = normalizeProviderId(provider.id);
	const spec = { ...provider, id };
	if (id === 'google') return createGoogleMusicAdapter(spec);
	if (id === 'minimax') return createMiniMaxMusicAdapter(spec);
	if (id === 'pika') return createPikaMusicAdapter(spec);
	if (id === 'elevenlabs') return createElevenLabsMusicAdapter(spec);
	if (id === 'stability-ai') return createStabilityMusicAdapter(spec);
	throw new MusicProviderUnsupportedError(`Text-to-audio provider is not supported: ${id}`);
}
