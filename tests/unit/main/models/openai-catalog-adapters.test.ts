import { buildImageAdapter } from '../../../../src/main/models/adapters/tti/tti_factory';
import { createOpenAISttAdapter } from '../../../../src/main/models/adapters/stt/stt_openai';
import type OpenAI from 'openai';

const sockets: { url: string; send: jest.Mock; emit: (event: string, data: string) => void }[] = [];
jest.mock('ws', () => {
	const { EventEmitter } = jest.requireActual('node:events');
	class MockSocket extends EventEmitter {
		static OPEN = 1;
		readyState = 1;
		send = jest.fn();
		close = jest.fn();
		constructor(readonly url: string) {
			super();
			sockets.push(this);
		}
	}
	return { __esModule: true, default: MockSocket };
});

describe('current OpenAI model contracts', () => {
	afterEach(() => jest.restoreAllMocks());

	it('generates GPT Image outputs with the selected format and quality', async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: 'UklGRimage' }] })));
		const result = await buildImageAdapter({
			id: 'openai',
			name: 'OpenAI',
			apiKey: 'key',
		}).generate({
			modelId: 'gpt-image-2.5-flare',
			prompt: 'cat',
			options: { output_format: 'webp', quality: 'xhigh' },
		});
		expect(String(fetch.mock.calls[0][0])).toBe('https://api.openai.com/v1/images/generations');
		expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
			model: 'gpt-image-2.5-flare',
			prompt: 'cat',
			n: 1,
			output_format: 'webp',
			quality: 'xhigh',
		});
		expect(result.mimeType).toBe('image/webp');
	});

	it('uploads image edits as multipart with image bytes and auth', async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: 'iVBORimage' }] })));
		await buildImageAdapter({ id: 'openai', name: 'OpenAI', apiKey: 'key' }).generate({
			modelId: 'gpt-image-2.5-sunburst',
			prompt: 'edit',
			source: { base64: 'aGVsbG8=', mimeType: 'image/png' },
		});
		const [url, init] = fetch.mock.calls[0];
		expect(String(url)).toBe('https://api.openai.com/v1/images/edits');
		expect(init?.headers).toEqual({ Authorization: 'Bearer key' });
		const form = init?.body as FormData;
		expect(form.get('model')).toBe('gpt-image-2.5-sunburst');
		expect(await (form.get('image') as Blob).text()).toBe('hello');
	});

	it('maps file language hints to languages without legacy temperature', async () => {
		const create = jest.fn().mockResolvedValue({ text: 'Hello' });
		const client = { audio: { transcriptions: { create } } } as unknown as OpenAI;
		await createOpenAISttAdapter({
			id: 'openai',
			name: 'OpenAI',
			apiKey: 'key',
			clientFactory: () => client,
		}).transcribe({
			providerId: 'openai',
			modelId: 'gpt-transcribe',
			language: 'en',
			temperature: 0.5,
			audio: { data: 'aGVsbG8=', encoding: 'base64', mimeType: 'audio/wav', fileName: 'test.wav' },
		});
		const body = create.mock.calls[0][0];
		expect(body.languages).toEqual(['en']);
		expect(body).not.toHaveProperty('language');
		expect(body).not.toHaveProperty('temperature');
	});

	it.each(['gpt-live-transcribe', 'gpt-transcribe'])(
		'opens a modern transcription session for %s',
		async (modelId) => {
			const emit = jest.fn();
			const adapter = createOpenAISttAdapter({ id: 'openai', name: 'OpenAI', apiKey: 'key' });
			const connection = await adapter.startRealtime!(
				{
					sessionId: 'session',
					providerId: 'openai',
					providerName: 'OpenAI',
					modelId,
					sampleRate: 24000,
					language: 'en',
				},
				emit
			);
			const socket = sockets[sockets.length - 1];
			expect(socket.url).toBe('wss://api.openai.com/v1/realtime?intent=transcription');
			expect(JSON.parse(socket.send.mock.calls[0][0])).toEqual({
				type: 'session.update',
				session: {
					type: 'transcription',
					audio: {
						input: {
							format: { type: 'audio/pcm', rate: 24000 },
							transcription: { model: modelId, languages: ['en'] },
							turn_detection: null,
						},
					},
				},
			});
			await connection.appendAudio('aGVsbG8=');
			await connection.finish();
			socket.emit(
				'message',
				JSON.stringify({
					type: 'conversation.item.input_audio_transcription.completed',
					transcript: 'Hello',
				})
			);
			expect(emit).toHaveBeenCalledWith(
				expect.objectContaining({ type: 'completed', transcript: 'Hello' })
			);
		}
	);
});
