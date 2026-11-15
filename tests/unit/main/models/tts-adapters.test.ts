import { createCartesiaSpeechAdapter } from '../../../../src/main/models/adapters/tts/tts_cartesia';
import { createDeepgramSpeechAdapter } from '../../../../src/main/models/adapters/tts/tts_deepgram';
import { createElevenLabsSpeechAdapter } from '../../../../src/main/models/adapters/tts/tts_elevenlabs';
import { createGoogleSpeechAdapter } from '../../../../src/main/models/adapters/tts/tts_google';
import { createMiniMaxSpeechAdapter } from '../../../../src/main/models/adapters/tts/tts_minimax';
import { createOpenAISpeechAdapter } from '../../../../src/main/models/adapters/tts/tts_openai';

const provider = {
	id: 'provider',
	name: 'Provider',
	apiKey: 'secret',
	baseURL: 'https://api.example.test/v1',
};

beforeEach(() => {
	jest.clearAllMocks();
	global.fetch = jest.fn();
});

it('maps OpenAI voice controls and preserves the requested audio format', async () => {
	jest
		.mocked(global.fetch)
		.mockResolvedValue(
			new Response(Uint8Array.from([1, 2]), { headers: { 'Content-Type': 'audio/flac' } })
		);
	const result = await createOpenAISpeechAdapter({ ...provider, id: 'openai' }).synthesize({
		text: 'Hello',
		providerId: 'openai',
		modelId: 'gpt-4o-mini-tts',
		options: { voice: 'cedar', instructions: 'Warm and calm', speed: 1.2, response_format: 'flac' },
	});

	const init = jest.mocked(global.fetch).mock.calls[0]?.[1];
	expect(JSON.parse(String(init?.body))).toEqual({
		model: 'gpt-4o-mini-tts',
		input: 'Hello',
		voice: 'cedar',
		instructions: 'Warm and calm',
		speed: 1.2,
		response_format: 'flac',
		stream_format: 'audio',
	});
	expect(result.mimeType).toBe('audio/flac');
});

it('maps an OpenAI custom voice ID to the provider voice object', async () => {
	jest.mocked(global.fetch).mockResolvedValue(new Response(Uint8Array.from([1])));
	await createOpenAISpeechAdapter({ ...provider, id: 'openai' }).synthesize({
		text: 'Hello',
		providerId: 'openai',
		modelId: 'gpt-4o-mini-tts',
		options: { custom_voice_id: 'voice_123' },
	});

	const init = jest.mocked(global.fetch).mock.calls[0]?.[1];
	expect(JSON.parse(String(init?.body)).voice).toEqual({ id: 'voice_123' });
});

it('maps Deepgram voice and media controls to query parameters', async () => {
	jest
		.mocked(global.fetch)
		.mockResolvedValue(
			new Response(Uint8Array.from([1]), { headers: { 'Content-Type': 'audio/ogg' } })
		);
	const result = await createDeepgramSpeechAdapter({ ...provider, id: 'deepgram' }).synthesize({
		text: 'Hello',
		providerId: 'deepgram',
		modelId: 'aura-2',
		options: {
			voice: 'aura-2-odysseus-en',
			encoding: 'opus',
			container: 'ogg',
			bit_rate: 48_000,
			speed: 1.1,
			mip_opt_out: true,
		},
	});

	const endpoint = jest.mocked(global.fetch).mock.calls[0]?.[0] as URL;
	expect(endpoint.searchParams.get('model')).toBe('aura-2-odysseus-en');
	expect(endpoint.searchParams.get('encoding')).toBe('opus');
	expect(endpoint.searchParams.get('container')).toBe('ogg');
	expect(endpoint.searchParams.get('bit_rate')).toBe('48000');
	expect(endpoint.searchParams.get('speed')).toBe('1.1');
	expect(endpoint.searchParams.get('mip_opt_out')).toBe('true');
	expect(result.mimeType).toBe('audio/ogg');
});

it('separates ElevenLabs path, query, and body options', async () => {
	jest
		.mocked(global.fetch)
		.mockResolvedValue(
			new Response(Uint8Array.from([1]), { headers: { 'Content-Type': 'audio/opus' } })
		);
	await createElevenLabsSpeechAdapter({ ...provider, id: 'elevenlabs' }).synthesize({
		text: 'Hello',
		providerId: 'elevenlabs',
		modelId: 'eleven_v3',
		options: {
			voice_id: 'voice-1',
			output_format: 'opus_48000_64',
			enable_logging: false,
			voice_settings: { stability: 0.4, similarity_boost: 0.8 },
			apply_text_normalization: 'on',
		},
	});

	const [endpoint, init] = jest.mocked(global.fetch).mock.calls[0] ?? [];
	const url = endpoint as URL;
	expect(url.pathname.endsWith('/text-to-speech/voice-1')).toBe(true);
	expect(url.searchParams.get('output_format')).toBe('opus_48000_64');
	expect(url.searchParams.get('enable_logging')).toBe('false');
	expect(JSON.parse(String(init?.body))).toEqual({
		text: 'Hello',
		model_id: 'eleven_v3',
		voice_settings: { stability: 0.4, similarity_boost: 0.8 },
		apply_text_normalization: 'on',
	});
});

it('maps Cartesia voice, output, and generation controls', async () => {
	jest
		.mocked(global.fetch)
		.mockResolvedValue(
			new Response(Uint8Array.from([1]), { headers: { 'Content-Type': 'audio/wav' } })
		);
	await createCartesiaSpeechAdapter({ ...provider, id: 'cartesia' }).synthesize({
		text: 'Hello',
		providerId: 'cartesia',
		modelId: 'sonic-3.5',
		options: {
			voice: { id: 'voice-1' },
			language: 'it',
			output_format: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 24_000 },
			generation_config: { volume: 1.2, speed: 0.9, emotion: 'content' },
		},
	});

	const init = jest.mocked(global.fetch).mock.calls[0]?.[1];
	expect(init?.headers).toEqual(
		expect.objectContaining({ Authorization: 'Bearer secret', 'Cartesia-Version': '2026-03-01' })
	);
	expect(JSON.parse(String(init?.body))).toEqual({
		model_id: 'sonic-3.5',
		transcript: 'Hello',
		voice: { mode: 'id', id: 'voice-1' },
		language: 'it',
		output_format: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 24_000 },
		generation_config: { volume: 1.2, speed: 0.9, emotion: 'content' },
	});
});

it('maps MiniMax nested voice and audio controls', async () => {
	jest.mocked(global.fetch).mockResolvedValue(
		new Response(
			JSON.stringify({
				data: { audio: '4142' },
				base_resp: { status_code: 0, status_msg: 'success' },
			}),
			{ headers: { 'Content-Type': 'application/json' } }
		)
	);
	const result = await createMiniMaxSpeechAdapter({ ...provider, id: 'minimax' }).synthesize({
		text: 'Hello',
		providerId: 'minimax',
		modelId: 'speech-2.8-hd',
		options: {
			voice_setting: { voice_id: 'English_Trustworth_Man', speed: 1.1, vol: 2, pitch: -1 },
			audio_setting: { sample_rate: 44_100, bitrate: 256_000, format: 'flac', channel: 2 },
			language_boost: 'English',
			voice_modify: { intensity: 20 },
		},
	});

	const init = jest.mocked(global.fetch).mock.calls[0]?.[1];
	expect(JSON.parse(String(init?.body))).toEqual({
		model: 'speech-2.8-hd',
		text: 'Hello',
		stream: false,
		output_format: 'hex',
		voice_setting: { voice_id: 'English_Trustworth_Man', speed: 1.1, vol: 2, pitch: -1 },
		audio_setting: { sample_rate: 44_100, bitrate: 256_000, format: 'flac', channel: 2 },
		language_boost: 'English',
		voice_modify: { intensity: 20 },
	});
	expect(result.mimeType).toBe('audio/flac');
});

it('maps Google voice and language settings', async () => {
	jest.mocked(global.fetch).mockResolvedValue(
		new Response(
			JSON.stringify({
				candidates: [
					{ content: { parts: [{ inlineData: { mimeType: 'audio/wav', data: 'QQ==' } }] } },
				],
			}),
			{ headers: { 'Content-Type': 'application/json' } }
		)
	);
	await createGoogleSpeechAdapter({ ...provider, id: 'google' }).synthesize({
		text: 'Ciao',
		providerId: 'google',
		modelId: 'gemini-3.1-flash-tts-preview',
		options: { voiceName: 'Sulafat', languageCode: 'it-IT' },
	});

	const init = jest.mocked(global.fetch).mock.calls[0]?.[1];
	expect(JSON.parse(String(init?.body)).generationConfig.speechConfig).toEqual({
		languageCode: 'it-IT',
		voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Sulafat' } },
	});
});

it('maps Google multi-speaker voice settings instead of a single voice', async () => {
	jest.mocked(global.fetch).mockResolvedValue(
		new Response(
			JSON.stringify({
				candidates: [
					{ content: { parts: [{ inlineData: { mimeType: 'audio/wav', data: 'QQ==' } }] } },
				],
			})
		)
	);
	const multiSpeakerVoiceConfig = {
		speakerVoiceConfigs: [
			{
				speaker: 'Joe',
				voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
			},
			{
				speaker: 'Jane',
				voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
			},
		],
	};
	await createGoogleSpeechAdapter({ ...provider, id: 'google' }).synthesize({
		text: 'Joe: Hello. Jane: Hi.',
		providerId: 'google',
		modelId: 'gemini-3.1-flash-tts-preview',
		options: { multiSpeakerVoiceConfig },
	});

	const init = jest.mocked(global.fetch).mock.calls[0]?.[1];
	expect(JSON.parse(String(init?.body)).generationConfig.speechConfig).toEqual({
		multiSpeakerVoiceConfig,
	});
});

it('maps Mistral voice, reference audio, cache, metadata, and format options', async () => {
	mistralComplete.mockResolvedValue({ audioData: 'QQ==' });
	await createMistralSpeechAdapter({ ...provider, id: 'mistral' }).synthesize({
		text: 'Hello',
		providerId: 'mistral',
		modelId: 'voxtral-mini-tts-2603',
		options: {
			voice_id: 'voice-1',
			ref_audio: 'data:audio/wav;base64,QQ==',
			response_format: 'wav',
			prompt_cache_key: 'cache-1',
			metadata: { source: 'kucedr' },
		},
	});

	expect(mistralComplete).toHaveBeenCalledWith({
		model: 'voxtral-mini-tts-2603',
		input: 'Hello',
		voiceId: 'voice-1',
		refAudio: 'data:audio/wav;base64,QQ==',
		responseFormat: 'wav',
		promptCacheKey: 'cache-1',
		metadata: { source: 'kucedr' },
		stream: false,
	});
	expect(mistralListVoices).not.toHaveBeenCalled();
});
