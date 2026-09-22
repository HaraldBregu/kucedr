const mk = (tag: string) => jest.fn((spec: unknown) => ({ tag, spec }));
const openai = mk('openai');
const deepgram = mk('deepgram');

jest.mock('../../../../src/main/models/adapters/stt/stt_openai', () => ({ createOpenAISttAdapter: openai }));
jest.mock('../../../../src/main/models/adapters/stt/stt_deepgram', () => ({ createDeepgramSttAdapter: deepgram }));
jest.mock('../../../../src/main/models/adapters/stt/stt_elevenlabs', () => ({ createElevenLabsSttAdapter: mk('e') }));
jest.mock('../../../../src/main/models/adapters/stt/stt_mistral', () => ({ createMistralSttAdapter: mk('m') }));
jest.mock('../../../../src/main/models/adapters/stt/stt_qwen', () => ({ createQwenSttAdapter: mk('q') }));
jest.mock('../../../../src/main/models/adapters/stt/stt_xai', () => ({ createXaiSttAdapter: mk('x') }));

import { buildSttAdapter } from '../../../../src/main/models/adapters/stt/stt_factory';
import { SttProviderUnsupportedError } from '../../../../src/main/models/adapters/stt/stt_errors';
import type { SttProviderSpec } from '../../../../src/main/models/adapters/stt/stt_types';

function spec(id: string): SttProviderSpec {
	return { id, apiKey: 'k' } as SttProviderSpec;
}

describe('buildSttAdapter', () => {
	it('dispatches to the matching adapter with a normalized id', () => {
		const result = buildSttAdapter(spec('OpenAI')) as unknown as { tag: string };
		expect(result.tag).toBe('openai');
		expect(openai).toHaveBeenCalledWith(expect.objectContaining({ id: 'openai' }));
	});

	it('normalizes whitespace and case before lookup', () => {
		buildSttAdapter(spec('  Deepgram  '));
		expect(deepgram).toHaveBeenCalledWith(expect.objectContaining({ id: 'deepgram' }));
	});

	it('throws for unsupported providers', () => {
		expect(() => buildSttAdapter(spec('unknown'))).toThrow(SttProviderUnsupportedError);
	});
});
