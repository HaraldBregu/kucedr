const mk = (tag: string) => jest.fn((spec: unknown) => ({ tag, spec }));
const ttaEleven = mk('tta-eleven');
const ttvGoogle = mk('ttv-google');

jest.mock('../../../../src/main/models/adapters/tta/tta_elevenlabs', () => ({ createElevenLabsMusicAdapter: ttaEleven }));
jest.mock('../../../../src/main/models/adapters/tta/tta_stability', () => ({ createStabilityMusicAdapter: mk('tta-stab') }));

jest.mock('../../../../src/main/models/adapters/ttv/ttv_google', () => ({ createGoogleVideoAdapter: ttvGoogle }));
jest.mock('../../../../src/main/models/adapters/ttv/ttv_kling', () => ({ createKlingVideoAdapter: mk('k') }));
jest.mock('../../../../src/main/models/adapters/ttv/ttv_luma', () => ({ createLumaVideoAdapter: mk('l') }));
jest.mock('../../../../src/main/models/adapters/ttv/ttv_minimax', () => ({ createMinimaxVideoAdapter: mk('m') }));
jest.mock('../../../../src/main/models/adapters/ttv/ttv_pika', () => ({ createPikaVideoAdapter: mk('p') }));
jest.mock('../../../../src/main/models/adapters/ttv/ttv_qwen', () => ({ createQwenVideoAdapter: mk('q') }));
jest.mock('../../../../src/main/models/adapters/ttv/ttv_runway', () => ({ createRunwayVideoAdapter: mk('r') }));
jest.mock('../../../../src/main/models/adapters/ttv/ttv_xai', () => ({ createXaiVideoAdapter: mk('x') }));

import { buildMusicAdapter } from '../../../../src/main/models/adapters/tta/tta_factory';
import { MusicProviderUnsupportedError } from '../../../../src/main/models/adapters/tta/tta_errors';
import type { MusicProviderSpec } from '../../../../src/main/models/adapters/tta/tta_types';
import { buildVideoAdapter } from '../../../../src/main/models/adapters/ttv/ttv_factory';
import { VideoProviderUnsupportedError } from '../../../../src/main/models/adapters/ttv/ttv_errors';
import type { VideoProviderSpec } from '../../../../src/main/models/adapters/ttv/ttv_types';

describe('buildMusicAdapter', () => {
	it('dispatches to elevenlabs', () => {
		const r = buildMusicAdapter({ id: 'ElevenLabs' } as MusicProviderSpec) as unknown as { tag: string };
		expect(r.tag).toBe('tta-eleven');
		expect(ttaEleven).toHaveBeenCalledWith(expect.objectContaining({ id: 'elevenlabs' }));
	});
	it('throws for unsupported providers', () => {
		expect(() => buildMusicAdapter({ id: 'nope' } as MusicProviderSpec)).toThrow(
			MusicProviderUnsupportedError
		);
	});
});

describe('buildVideoAdapter', () => {
	it('dispatches to google', () => {
		const r = buildVideoAdapter({ id: 'Google' } as VideoProviderSpec) as unknown as { tag: string };
		expect(r.tag).toBe('ttv-google');
	});
	it('rejects midjourney explicitly', () => {
		expect(() => buildVideoAdapter({ id: 'midjourney' } as VideoProviderSpec)).toThrow(
			/does not expose a public API/
		);
	});
	it('throws for unknown providers', () => {
		expect(() => buildVideoAdapter({ id: 'nope' } as VideoProviderSpec)).toThrow(
			VideoProviderUnsupportedError
		);
	});
});
