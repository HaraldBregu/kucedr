import { buildImageAdapter } from '../../../../src/main/models/adapters/tti/tti_factory';
import { buildVideoAdapter } from '../../../../src/main/models/adapters/ttv/ttv_factory';
import { buildSttAdapter } from '../../../../src/main/models/adapters/stt/stt_factory';
import { buildSpeechAdapter } from '../../../../src/main/models/adapters/tts/tts_factory';

beforeEach(() => jest.restoreAllMocks());
const zai = { id: 'zai', name: 'Z.ai', apiKey: 'key' };

it('downloads Z.ai generated images from the URL response', async () => {
	const fetch = jest
		.spyOn(globalThis, 'fetch')
		.mockResolvedValueOnce(
			new Response(JSON.stringify({ data: [{ url: 'https://media.test/image.png' }] }))
		)
		.mockResolvedValueOnce(new Response('image', { headers: { 'Content-Type': 'image/png' } }));
	const result = await buildImageAdapter(zai).generate({
		modelId: 'glm-image',
		prompt: 'cat',
		options: { size: '1280x1280' },
	});
	expect(fetch.mock.calls[0][0]).toBe('https://api.z.ai/api/paas/v4/images/generations');
	expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
		model: 'glm-image',
		prompt: 'cat',
		size: '1280x1280',
	});
	expect(result).toEqual({
		base64: Buffer.from('image').toString('base64'),
		mimeType: 'image/png',
	});
});

it('polls Z.ai asynchronous video results and preserves first/last frame inputs', async () => {
	const fetch = jest
		.spyOn(globalThis, 'fetch')
		.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'task' })))
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					task_status: 'SUCCESS',
					video_result: [{ url: 'https://media.test/video.mp4' }],
				})
			)
		)
		.mockResolvedValueOnce(new Response('video', { headers: { 'Content-Type': 'video/mp4' } }));
	const result = await buildVideoAdapter(zai).generate({
		modelId: 'cogvideox-3',
		prompt: 'cat',
		options: {
			image_url: ['https://media.test/first.jpg', 'https://media.test/last.jpg'],
			duration: 10,
			quality: 'speed',
		},
	});
	expect(fetch.mock.calls[1][0]).toBe('https://api.z.ai/api/paas/v4/async-result/task');
	expect(JSON.parse(String(fetch.mock.calls[0][1]?.body)).image_url).toHaveLength(2);
	expect(result.mimeType).toBe('video/mp4');
});

it('routes GLM ASR away from saved coding endpoints and uploads native multipart fields', async () => {
	const fetch = jest
		.spyOn(globalThis, 'fetch')
		.mockResolvedValue(new Response(JSON.stringify({ text: 'hello' })));
	const result = await buildSttAdapter({
		...zai,
		baseURL: 'https://api.z.ai/api/coding/paas/v4',
	}).transcribe({
		providerId: 'zai',
		modelId: 'glm-asr-2512',
		audio: {
			encoding: 'base64',
			mimeType: 'audio/wav',
			data: Buffer.from('audio').toString('base64'),
		},
		prompt: 'context',
	});
	expect(String(fetch.mock.calls[0][0])).toBe('https://api.z.ai/api/paas/v4/audio/transcriptions');
	const form = fetch.mock.calls[0][1]?.body as FormData;
	expect(form.get('model')).toBe('glm-asr-2512');
	expect(form.get('stream')).toBe('false');
	expect(form.get('prompt')).toBe('context');
	expect(form.get('file')).toBeInstanceOf(Blob);
	expect(result.text).toBe('hello');
});

it('uses the unversioned xAI TTS service without sending a fictional model ID', async () => {
	const fetch = jest
		.spyOn(globalThis, 'fetch')
		.mockResolvedValue(new Response('audio', { headers: { 'Content-Type': 'audio/wav' } }));
	const result = await buildSpeechAdapter({
		id: 'xai',
		name: 'xAI',
		apiKey: 'key',
		baseURL: 'https://api.x.ai/v1',
	}).synthesize({
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
