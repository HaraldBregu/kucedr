import { synthesize } from '../../../../src/main/models/adapters/tts/tts_synthesize';
import { getProvider } from '../../../../src/main/settings_store';
import { buildSpeechAdapter } from '../../../../src/main/models/adapters/tts/tts_factory';

jest.mock('../../../../src/main/settings_store', () => ({ getProvider: jest.fn() }));
jest.mock('../../../../src/main/models/adapters/tts/tts_factory', () => ({
	buildSpeechAdapter: jest.fn(() => ({
		synthesize: jest.fn().mockResolvedValue({ audio: 'result' }),
	})),
}));

describe('regional speech models', () => {
	it.each([
		[
			'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
			'https://dashscope.aliyuncs.com/api/v1',
		],
		['https://speech.example.test/custom', 'https://speech.example.test/custom'],
	])(
		'uses the documented regional URL while preserving custom endpoints for %s',
		async (baseUrl, expected) => {
			jest
				.mocked(getProvider)
				.mockReturnValue({ id: 'qwen', name: 'Qwen', apiKey: 'key', baseUrl });
			await synthesize(
				{ providerId: 'qwen', modelId: 'qwen-audio-3.0-tts-plus', text: 'Hello' },
				'tool'
			);
			expect(buildSpeechAdapter).toHaveBeenLastCalledWith(
				expect.objectContaining({ baseURL: expected })
			);
		}
	);
});
