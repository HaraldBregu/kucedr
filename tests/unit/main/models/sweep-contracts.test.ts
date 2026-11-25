import { buildSpeechAdapter } from '../../../../src/main/models/adapters/tts/tts_factory';

beforeEach(() => jest.restoreAllMocks());

it('uses the unversioned xAI TTS service without sending a fictional model ID', async () => {
	const fetch = jest
		.spyOn(globalThis, 'fetch')
		.mockResolvedValue(new Response('audio', { headers: { 'Content-Type': 'audio/wav' } }));
	const result = await buildSpeechAdapter(
		{
			id: 'xai',
			name: 'xAI',
			apiKey: 'key',
			baseURL: 'https://api.x.ai/v1',
			protocol: 'tts',
		},
		'xAI TTS'
	).synthesize({
		providerId: 'xai',
		modelId: 'xai-tts',
		text: 'hello',
		voice: 'ara',
		options: { language: 'en', speed: 1.2, output_format: { codec: 'wav' } },
	});
	expect(String(fetch.mock.calls[0][0])).toBe('https://api.x.ai/v1/tts');
	expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
		text: 'hello',
		voice_id: 'ara',
		language: 'en',
		speed: 1.2,
		output_format: { codec: 'wav' },
		with_timestamps: false,
	});
	expect(result.mimeType).toBe('audio/wav');
});
