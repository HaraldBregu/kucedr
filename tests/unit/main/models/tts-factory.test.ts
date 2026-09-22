const mk = (tag: string) => jest.fn((spec: unknown) => ({ tag, spec }));
const elevenlabs = mk('elevenlabs');

jest.mock('../../../../src/main/models/adapters/tts/tts_cartesia', () => ({ createCartesiaSpeechAdapter: mk('c') }));
jest.mock('../../../../src/main/models/adapters/tts/tts_deepgram', () => ({ createDeepgramSpeechAdapter: mk('d') }));
jest.mock('../../../../src/main/models/adapters/tts/tts_elevenlabs', () => ({ createElevenLabsSpeechAdapter: elevenlabs }));
jest.mock('../../../../src/main/models/adapters/tts/tts_google', () => ({ createGoogleSpeechAdapter: mk('g') }));
jest.mock('../../../../src/main/models/adapters/tts/tts_minimax', () => ({ createMiniMaxSpeechAdapter: mk('mm') }));
jest.mock('../../../../src/main/models/adapters/tts/tts_mistral', () => ({ createMistralSpeechAdapter: mk('mi') }));
jest.mock('../../../../src/main/models/adapters/tts/tts_openai', () => ({ createOpenAISpeechAdapter: mk('o') }));

import { buildSpeechAdapter } from '../../../../src/main/models/adapters/tts/tts_factory';
import { SpeechProviderUnsupportedError } from '../../../../src/main/models/adapters/tts/tts_errors';
import type { SpeechProviderSpec } from '../../../../src/main/models/adapters/tts/tts_types';

function spec(id: string): SpeechProviderSpec {
	return { id, apiKey: 'k' } as SpeechProviderSpec;
}

describe('buildSpeechAdapter', () => {
	it('dispatches to the matching adapter with a normalized id', () => {
		const result = buildSpeechAdapter(spec('ElevenLabs')) as unknown as { tag: string };
		expect(result.tag).toBe('elevenlabs');
		expect(elevenlabs).toHaveBeenCalledWith(expect.objectContaining({ id: 'elevenlabs' }));
	});

	it('throws for unsupported providers', () => {
		expect(() => buildSpeechAdapter(spec('unknown'))).toThrow(SpeechProviderUnsupportedError);
	});
});
