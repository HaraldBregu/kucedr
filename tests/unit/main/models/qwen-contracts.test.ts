const mockSockets: Array<{
	emit: (event: string, data?: unknown) => void;
	send: jest.Mock;
	close: jest.Mock;
}> = [];
jest.mock('ws', () => ({
	__esModule: true,
	default: class
		extends jest.requireActual<typeof import('node:events')>('node:events').EventEmitter
	{
		send = jest.fn((data: string | Buffer) => {
			if (typeof data === 'string' && JSON.parse(data).header.action === 'run-task')
				process.nextTick(() =>
					this.emit('message', JSON.stringify({ header: { event: 'task-started' } }))
				);
		});
		close = jest.fn(() => this.emit('close'));
		constructor() {
			super();
			mockSockets.push(this);
			process.nextTick(() => this.emit('open'));
		}
	},
}));

import { createQwenSttAdapter } from '../../../../src/main/models/adapters/stt/stt_qwen';
import { createQwenSpeechAdapter } from '../../../../src/main/models/adapters/tts/tts_qwen';
import { createQwenImageAdapter } from '../../../../src/main/models/adapters/tti/tti_qwen';
import { createQwenVideoAdapter } from '../../../../src/main/models/adapters/ttv/ttv_qwen';
import type { SttRealtimeEvent } from '../../../../src/shared/stt_transcription';

beforeEach(() => {
	jest.restoreAllMocks();
});

const provider = {
	id: 'qwen',
	name: 'Qwen',
	apiKey: 'key',
	baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
};

it('sends Qwen Audio 3.1 batch audio as a data URI with required parameters', async () => {
	const fetch = jest
		.spyOn(globalThis, 'fetch')
		.mockResolvedValue(
			new Response(
				JSON.stringify({ output: { text: 'Hello' }, usage: { input_tokens: 10, output_tokens: 1 } })
			)
		);
	const result = await createQwenSttAdapter(provider).transcribe({
		providerId: 'qwen',
		modelId: 'qwen-audio-3.1-asr-flash',
		audio: { data: 'QQ==', encoding: 'base64', mimeType: 'audio/wav', fileName: 'sample.wav' },
		language: 'en',
		prompt: 'Names: Alice',
	});
	expect(String(fetch.mock.calls[0][0])).toBe(
		'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
	);
	expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({
		input: {
			messages: [
				{ role: 'user', content: [{ type: 'input_text', text: 'Names: Alice' }] },
				{
					role: 'user',
					content: [{ type: 'input_audio', input_audio: { data: 'data:audio/wav;base64,QQ==' } }],
				},
			],
		},
		parameters: { format: 'wav', language_hints: ['en'] },
	});
	expect(result.text).toBe('Hello');
	expect(result.metadata.usage?.inputTokens).toBe(10);
});

it('maps Qwen Audio TTS controls and downloads returned audio', async () => {
	const fetch = jest
		.spyOn(globalThis, 'fetch')
		.mockResolvedValueOnce(
			new Response(JSON.stringify({ output: { audio: { url: 'https://audio.test/file' } } }))
		)
		.mockResolvedValueOnce(new Response(new Uint8Array([1, 2])));
	const result = await createQwenSpeechAdapter({
		...provider,
		baseURL: 'https://workspace.cn-beijing.maas.aliyuncs.com',
	}).synthesize({
		providerId: 'qwen',
		modelId: 'qwen-audio-3.0-tts-plus',
		text: 'Hello',
		options: { format: 'wav', instruction: 'Calm', rate: 1.2 },
	});
	expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({
		input: { text: 'Hello', voice: 'longanlingxin', format: 'wav', instruction: 'Calm', rate: 1.2 },
	});
	expect(result.mimeType).toBe('audio/wav');
	expect(result.audio).toBe('AQI=');
});

it('moves Qwen Image reference images into content rather than parameters', async () => {
	const fetch = jest
		.spyOn(globalThis, 'fetch')
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					output: { choices: [{ message: { content: [{ image: 'https://image.test/result' }] } }] },
				})
			)
		)
		.mockResolvedValueOnce(
			new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/png' } })
		);
	await createQwenImageAdapter(provider).generate({
		modelId: 'qwen-image-2.1-pro',
		prompt: 'Combine',
		source: { mimeType: 'image/png', base64: 'QQ==' },
		options: { image: ['https://image.test/reference'], n: 1 },
	});
	const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
	expect(body.input.messages[0].content).toEqual([
		{ image: 'data:image/png;base64,QQ==' },
		{ image: 'https://image.test/reference' },
		{ text: 'Combine' },
	]);
	expect(body.parameters).toEqual({ n: 1 });
});

it('moves Wan 3 media references into input and polls the submitted task', async () => {
	const fetch = jest
		.spyOn(globalThis, 'fetch')
		.mockResolvedValueOnce(new Response(JSON.stringify({ output: { task_id: 'task' } })))
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					output: { task_status: 'SUCCEEDED', video_url: 'https://video.test/result' },
				})
			)
		)
		.mockResolvedValueOnce(
			new Response(new Uint8Array([1]), { headers: { 'content-type': 'video/mp4' } })
		);
	const media = [{ type: 'first_frame', url: 'https://image.test/reference' }];
	await createQwenVideoAdapter(provider).generate({
		modelId: 'wan3.0-video',
		prompt: 'Animate',
		options: { media, duration: 10 },
	});
	const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
	expect(body.input).toEqual({ prompt: 'Animate', media });
	expect(body.parameters).toEqual({ duration: 10 });
	expect(String(fetch.mock.calls[1][0])).toContain('/tasks/task');
});

it('starts DashScope ASR before sending binary audio and completes all sentences', async () => {
	const events: SttRealtimeEvent[] = [];
	const adapter = createQwenSttAdapter(provider);
	const connection = await adapter.startRealtime!(
		{
			sessionId: 'session',
			providerId: 'qwen',
			providerName: 'Qwen',
			modelId: 'qwen-audio-3.1-asr-flash-streaming',
			sampleRate: 16000,
			language: 'en',
		},
		(event) => events.push(event)
	);
	const socket = mockSockets.at(-1)!;
	await connection.appendAudio('AQI=');
	expect(socket.send).toHaveBeenCalledWith(Buffer.from([1, 2]));
	for (const sentence of [
		{ sentence_id: 1, text: 'Hello', sentence_end: true },
		{ sentence_id: 2, text: 'world', sentence_end: true },
	])
		socket.emit(
			'message',
			JSON.stringify({ header: { event: 'result-generated' }, payload: { output: { sentence } } })
		);
	await connection.finish();
	socket.emit('message', JSON.stringify({ header: { event: 'task-finished' } }));
	expect(events).toContainEqual({
		type: 'completed',
		sessionId: 'session',
		itemId: 'session',
		contentIndex: 0,
		transcript: 'Hello world',
	});
	expect(socket.close).toHaveBeenCalled();
});
