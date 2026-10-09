import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { createCartesiaSttAdapter } from '../../../../src/main/models/adapters/stt/stt_cartesia';
import { createCartesiaSpeechAdapter } from '../../../../src/main/models/adapters/tts/tts_cartesia';
import { createCohereSttAdapter } from '../../../../src/main/models/adapters/stt/stt_cohere';
import { createDeepgramSttAdapter } from '../../../../src/main/models/adapters/stt/stt_deepgram';
import { createElevenLabsSpeechAdapter } from '../../../../src/main/models/adapters/tts/tts_elevenlabs';
import { createElevenLabsMusicAdapter } from '../../../../src/main/models/adapters/tta/tta_elevenlabs';
import { synthesize } from '../../../../src/main/models/adapters/tts/tts_synthesize';
import { transcribe } from '../../../../src/main/models/adapters/stt/stt_transcribe';
import { createEmbedding } from '../../../../src/main/models/embedding/embedding_create';

jest.mock('ws', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../../src/main/settings_store', () => ({
	getProvider: (id: string) => ({
		id,
		name: id,
		apiKey: ' test-key ',
		baseUrl: {
			cartesia: 'https://api.cartesia.ai',
			cohere: 'https://api.cohere.ai/compatibility/v1',
			elevenlabs: 'https://api.elevenlabs.io/v1',
			mistral: 'https://api.mistral.ai/v1',
			jina: 'https://api.jina.ai/v1',
		}[id],
	}),
}));
jest.mock('../../../../src/main/models/selection', () => ({
	getProviderId: () => undefined,
	getModelId: () => undefined,
	setSelection: jest.fn(),
	resolveOptions: (_kind: string, _provider: string, _model: string, overrides: unknown) =>
		overrides,
}));

const provider = { id: 'provider', name: 'Provider', apiKey: 'test-key' };
const audio = {
	data: 'QQ==',
	mimeType: 'audio/wav',
	fileName: 'sample.wav',
	encoding: 'base64' as const,
};
const realtime = {
	sessionId: 'session',
	providerId: 'provider',
	providerName: 'Provider',
	modelId: 'ink-2',
	sampleRate: 16000,
};
let socket: EventEmitter & { send: jest.Mock; close: jest.Mock; readyState: number };

beforeEach(() => {
	jest.clearAllMocks();
	global.fetch = jest.fn();
	socket = Object.assign(new EventEmitter(), { send: jest.fn(), close: jest.fn(), readyState: 0 });
	(WebSocket as unknown as jest.Mock).mockImplementation(() => socket);
});

it('uploads Ink Whisper batch audio using the documented version and multipart fields', async () => {
	jest
		.mocked(fetch)
		.mockResolvedValue(
			new Response(JSON.stringify({ text: 'hello', language: 'en', duration: 1.5 }))
		);
	const result = await transcribe({
		providerId: 'cartesia',
		modelId: 'ink-whisper',
		audio,
		language: 'en',
	});
	const [url, init] = jest.mocked(fetch).mock.calls[0]!;
	expect(String(url)).toBe('https://api.cartesia.ai/stt');
	expect(init?.headers).toEqual({
		Authorization: 'Bearer test-key',
		'Cartesia-Version': '2026-08-14',
	});
	expect((init?.body as FormData).get('model')).toBe('ink-whisper');
	expect((init?.body as FormData).get('file')).toBeInstanceOf(File);
	expect(result).toMatchObject({ text: 'hello', metadata: { usage: { durationSeconds: 1.5 } } });
});

it('preserves Ink 2 final transcript whitespace and flushes audio before completing', async () => {
	const events = jest.fn();
	const pending = createCartesiaSttAdapter({ ...provider, id: 'cartesia' }).startRealtime!(
		{ ...realtime, language: 'fr' },
		events
	);
	socket.emit('open');
	const connection = await pending;
	const [endpoint, config] = (WebSocket as unknown as jest.Mock).mock.calls[0]!;
	expect(endpoint.pathname).toBe('/stt/websocket');
	expect(endpoint.searchParams.get('model')).toBe('ink-2');
	expect(endpoint.searchParams.get('cartesia_version')).toBe('2026-08-14');
	expect(endpoint.searchParams.has('language')).toBe(false);
	expect(config.headers['X-API-Key']).toBe('test-key');
	await connection.appendAudio('QQ==');
	expect(socket.send).toHaveBeenCalledWith(Buffer.from('A'));
	socket.emit(
		'message',
		Buffer.from(JSON.stringify({ type: 'transcript', text: 'ignored', is_final: false }))
	);
	socket.emit(
		'message',
		Buffer.from(JSON.stringify({ type: 'transcript', text: 'Hello', is_final: true }))
	);
	socket.emit(
		'message',
		Buffer.from(JSON.stringify({ type: 'transcript', text: ', world.', is_final: true }))
	);
	await connection.finish();
	expect(socket.send).toHaveBeenLastCalledWith('close');
	expect(events).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'completed' }));
	socket.emit('message', Buffer.from(JSON.stringify({ type: 'done' })));
	expect(events).toHaveBeenCalledWith(
		expect.objectContaining({ type: 'completed', transcript: 'Hello, world.' })
	);
});

it('supplies Cohere Arabic language and puts the audio last in multipart form', async () => {
	jest.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ text: 'transcript' })));
	await transcribe({
		providerId: 'cohere',
		modelId: 'cohere-transcribe-arabic-07-2026',
		audio,
		temperature: 0.2,
	});
	const [url, init] = jest.mocked(fetch).mock.calls[0]!;
	expect(String(url)).toBe('https://api.cohere.ai/compatibility/v1/audio/transcriptions');
	const form = init?.body as FormData;
	expect(form.get('language')).toBe('ar');
	expect(form.get('temperature')).toBe('0.2');
	expect(Array.from(form.keys())).toEqual(['model', 'language', 'temperature', 'file']);
});

it('routes multilingual Flux through v2 and completes only EndOfTurn events', async () => {
	const events = jest.fn();
	const pending = createDeepgramSttAdapter({
		...provider,
		id: 'deepgram',
		baseURL: 'https://api.deepgram.com/v1',
	}).startRealtime!({ ...realtime, modelId: 'flux-general-multi', language: 'it' }, events);
	socket.emit('open');
	await pending;
	const endpoint = new URL((WebSocket as unknown as jest.Mock).mock.calls[0]![0]);
	expect(endpoint.pathname).toBe('/v2/listen');
	expect(endpoint.searchParams.get('language_hint')).toBe('it');
	expect(endpoint.searchParams.has('interim_results')).toBe(false);
	socket.emit(
		'message',
		Buffer.from(
			JSON.stringify({ type: 'TurnInfo', event: 'Update', transcript: 'ciao', turn_index: 0 })
		)
	);
	expect(events).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'completed' }));
	socket.emit(
		'message',
		Buffer.from(
			JSON.stringify({
				type: 'TurnInfo',
				event: 'EndOfTurn',
				transcript: 'ciao mondo',
				turn_index: 0,
			})
		)
	);
	expect(events).toHaveBeenCalledWith(
		expect.objectContaining({ type: 'completed', transcript: 'ciao mondo' })
	);
});

it('uses Text to Dialogue for Eleven v4 with the selected voice', async () => {
	jest
		.mocked(fetch)
		.mockResolvedValue(
			new Response(Uint8Array.from([1, 2]), { headers: { 'Content-Type': 'audio/mpeg' } })
		);
	await createElevenLabsSpeechAdapter({
		...provider,
		id: 'elevenlabs',
		baseURL: 'https://api.elevenlabs.io/v1',
	}).synthesize({
		providerId: 'elevenlabs',
		modelId: 'eleven_v4',
		text: 'Hello',
		voice: 'voice-1',
		options: { output_format: 'mp3_44100_128', settings: { stability: 0.5 } },
	});
	const [url, init] = jest.mocked(fetch).mock.calls[0]!;
	expect((url as URL).pathname).toBe('/v1/text-to-dialogue');
	expect(JSON.parse(String(init?.body))).toEqual({
		inputs: [{ text: 'Hello', voice_id: 'voice-1' }],
		model_id: 'eleven_v4',
		settings: { stability: 0.5 },
	});
});

it.each(['eleven_v4_turbo', 'eleven_v3_conversational'])(
	'collects selected Eleven dialogue model %s through the application entry point',
	async (modelId) => {
		const pending = synthesize({
			providerId: 'elevenlabs',
			modelId,
			text: 'Hello',
			voice: 'voice-1',
		});
		socket.emit('open');
		expect(
			new URL(String((WebSocket as unknown as jest.Mock).mock.calls[0]![0])).searchParams.get(
				'model_id'
			)
		).toBe(modelId);
		expect(socket.send.mock.calls.map(([frame]) => JSON.parse(frame))).toEqual([
			{ voices: ['voice-1'] },
			{ inputs: [{ text: 'Hello', voice_id: 'voice-1' }] },
			{ close_socket: true },
		]);
		socket.emit('message', Buffer.from(JSON.stringify({ audio: 'QQ==' })));
		socket.emit('message', Buffer.from(JSON.stringify({ audio: 'Qg==', is_final: true })));
		await expect(pending).resolves.toMatchObject({ audio: 'QUI=', mimeType: 'audio/mpeg' });
	}
);

it('rejects truncated Eleven dialogue audio', async () => {
	const pending = createElevenLabsSpeechAdapter({
		...provider,
		id: 'elevenlabs',
		baseURL: 'https://api.elevenlabs.io/v1',
	}).synthesize({ providerId: 'elevenlabs', modelId: 'eleven_v4_turbo', text: 'Hello' });
	socket.emit('close');
	await expect(pending).rejects.toThrow('before final audio');
});

it.each(['music_v2', 'music_v2_5', 'eleven_text_to_sound_v2'])(
	'sends the selected Eleven audio model %s and query output format',
	async (modelId) => {
		jest.mocked(fetch).mockResolvedValue(new Response(Uint8Array.from([1])));
		await createElevenLabsMusicAdapter({ ...provider, id: 'elevenlabs' }).generate({
			modelId,
			prompt: 'An ocean',
			options: { output_format: 'mp3_44100_128' },
		});
		const [url, init] = jest.mocked(fetch).mock.calls[0]!;
		expect(new URL(String(url)).pathname).toBe(
			modelId === 'eleven_text_to_sound_v2' ? '/v1/sound-generation' : '/v1/music'
		);
		expect(new URL(String(url)).searchParams.get('output_format')).toBe('mp3_44100_128');
		expect(JSON.parse(String(init?.body))).toEqual({
			[modelId === 'eleven_text_to_sound_v2' ? 'text' : 'prompt']: 'An ocean',
			model_id: modelId,
		});
	}
);

it('uses the current Sonic 3.6 version and direct voice ID contract', async () => {
	jest.mocked(fetch).mockResolvedValue(new Response(Uint8Array.from([1])));
	await synthesize({
		providerId: 'cartesia',
		modelId: 'sonic-3.6',
		text: 'Hello',
		options: { voice: 'voice-1', locale: 'en-GB', normalization: 'auto' },
	});
	const init = jest.mocked(fetch).mock.calls[0]![1];
	expect(init?.headers).toMatchObject({ 'Cartesia-Version': '2026-08-14' });
	expect(JSON.parse(String(init?.body))).toMatchObject({
		model_id: 'sonic-3.6',
		voice: 'voice-1',
		locale: 'en-GB',
		normalization: 'auto',
	});
});

it.each([
	['cohere', 'embed-v5.0-pro', 'https://api.cohere.com/v2/embed'],
	['mistral', 'codestral-embed-2505', 'https://api.mistral.ai/v1/embeddings'],
	['jina', 'jina-embeddings-v5-omni-small', 'https://api.jina.ai/v1/embeddings'],
])(
	'routes selected %s embeddings independently of its saved chat URL',
	async (providerId, modelId, endpoint) => {
		jest.mocked(fetch).mockResolvedValue(
			new Response(
				JSON.stringify({
					model: modelId,
					data: [{ index: 0, embedding: [0.1, 0.2] }],
					embeddings: { float: [[0.1, 0.2]] },
				})
			)
		);
		await expect(
			createEmbedding({ providerId, modelId, texts: ['A document'] })
		).resolves.toMatchObject({
			providerId,
			modelId,
			embeddings: [[0.1, 0.2]],
		});
		const [url, init] = jest.mocked(fetch).mock.calls[0]!;
		expect(String(url)).toBe(endpoint);
		expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-key' });
		expect(JSON.parse(String(init?.body))).toMatchObject({ model: modelId });
	}
);
