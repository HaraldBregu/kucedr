import { createBflImageAdapter } from '../../../../src/main/models/adapters/tti/tti_bfl';
import { createBflVideoAdapter } from '../../../../src/main/models/adapters/ttv/ttv_bfl';
import { createIdeogramImageAdapter } from '../../../../src/main/models/adapters/tti/tti_ideogram';
import { createGoogleMusicAdapter } from '../../../../src/main/models/adapters/tta/tta_google';
import { createGoogleVideoAdapter } from '../../../../src/main/models/adapters/ttv/ttv_google';
import { createGoogleSttAdapter } from '../../../../src/main/models/adapters/stt/stt_google';
import { createGoogleSpeechAdapter } from '../../../../src/main/models/adapters/tts/tts_google';
import { createMinimaxVideoAdapter } from '../../../../src/main/models/adapters/ttv/ttv_minimax';
import { createMiniMaxImageAdapter } from '../../../../src/main/models/adapters/tti/tti_minimax';
import { createMiniMaxMusicAdapter } from '../../../../src/main/models/adapters/tta/tta_minimax';
import { createMiniMaxSttAdapter } from '../../../../src/main/models/adapters/stt/stt_minimax';
import { createPikaVideoAdapter } from '../../../../src/main/models/adapters/ttv/ttv_pika';
import { createPikaMusicAdapter } from '../../../../src/main/models/adapters/tta/tta_pika';
import { createPikaSpeechAdapter } from '../../../../src/main/models/adapters/tts/tts_pika';
import { createKlingVideoAdapter } from '../../../../src/main/models/adapters/ttv/ttv_kling';
import { createKlingImageAdapter } from '../../../../src/main/models/adapters/tti/tti_kling';
import { createKlingMusicAdapter } from '../../../../src/main/models/adapters/tta/tta_kling';

const spec = { id: 'provider', name: 'Provider', apiKey: 'key' };
const source = { base64: 'aGVsbG8=', mimeType: 'image/png' as const };
const audio = {
	data: 'aGVsbG8=',
	encoding: 'base64' as const,
	mimeType: 'audio/wav',
	fileName: 'speech.wav',
};
const json = (data: unknown): Response =>
	new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });

afterEach(() => jest.restoreAllMocks());

describe('documented media API contracts', () => {
	it.each(['flux-3-image', 'flux-2-max', 'flux-2-klein-9b'])(
		'edits source images using %s',
		async (modelId) => {
			const fetch = jest
				.spyOn(globalThis, 'fetch')
				.mockResolvedValueOnce(json({ id: 'job', polling_url: 'https://poll.test' }))
				.mockResolvedValueOnce(json({ status: 'Ready', result: { sample: 'https://image.test' } }))
				.mockResolvedValueOnce(new Response('image', { headers: { 'content-type': 'image/png' } }));
			await createBflImageAdapter(spec).generate({ modelId, prompt: 'edit', source });
			expect(fetch.mock.calls[0][0]).toBe(`https://api.bfl.ai/v1/${modelId}`);
			const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
			expect(modelId === 'flux-3-image' ? body.images : body.input_image).toEqual(
				modelId === 'flux-3-image' ? [source.base64] : source.base64
			);
		}
	);

	it('submits FLUX 3 video in t2v mode and downloads its polled sample', async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json({ polling_url: 'https://poll.test' }))
			.mockResolvedValueOnce(json({ status: 'Ready', result: { sample: 'https://video.test' } }))
			.mockResolvedValueOnce(new Response('video'));
		await createBflVideoAdapter(spec).generate({
			modelId: 'flux-3-video',
			prompt: 'sunrise',
			options: { duration: 10 },
		});
		expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
			mode: 't2v',
			prompt: 'sunrise',
			duration: 10,
		});
		expect(fetch.mock.calls[0][1]?.headers).toEqual(expect.objectContaining({ 'x-key': 'key' }));
	});

	it('sends the Ideogram 4 natural-language text_prompt field', async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json({ data: [{ url: 'https://image.test' }] }))
			.mockResolvedValueOnce(new Response('image'));
		await createIdeogramImageAdapter(spec).generate({ modelId: 'ideogram-4.0', prompt: 'cat' });
		expect(fetch.mock.calls[0][0]).toBe('https://api.ideogram.ai/v1/ideogram-v4/generate');
		expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ text_prompt: 'cat' });
	});

	it('uploads a source image to Ideogram 4.5 using multipart', async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json({ data: [{ url: 'https://image.test' }] }))
			.mockResolvedValueOnce(new Response('image'));
		await createIdeogramImageAdapter(spec).generate({
			modelId: 'ideogram-4.5',
			prompt: 'edit',
			source,
		});
		const form = fetch.mock.calls[0][1]?.body as FormData;
		expect(form.get('prompt')).toBe('edit');
		expect(form.get('images')).toBeInstanceOf(Blob);
		expect(fetch.mock.calls[0][1]?.headers).toEqual({ 'Api-Key': 'key' });
	});

	it('generates Lyria 3.5 from the REST model_output audio block', async () => {
		const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			json({
				steps: [
					{ type: 'thought', content: [{ type: 'audio', data: 'wrong' }] },
					{
						type: 'model_output',
						content: [
							{ type: 'text', text: 'lyrics' },
							{ type: 'audio', data: 'song', mime_type: 'audio/mp3' },
						],
					},
				],
			})
		);
		const result = await createGoogleMusicAdapter({
			...spec,
			baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
		}).generate({ modelId: 'lyria-3.5', prompt: 'jazz' });
		expect(fetch.mock.calls[0][0]).toBe(
			'https://generativelanguage.googleapis.com/v1beta/interactions'
		);
		expect(result).toEqual({ base64: 'song', mimeType: 'audio/mp3' });
	});

	it('generates Gemini Omni video through Interactions', async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				json({
					steps: [
						{
							type: 'model_output',
							content: [{ type: 'video', data: 'video', mime_type: 'video/mp4' }],
						},
					],
				})
			);
		const result = await createGoogleVideoAdapter(spec).generate({
			modelId: 'gemini-omni-1.1-flash',
			prompt: 'sunrise',
		});
		expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
			model: 'gemini-omni-1.1-flash',
			input: 'sunrise',
		});
		expect(result.base64).toBe('video');
	});

	it('uses official Veo identifiers and separates input media from generation parameters', async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json({ name: 'operations/video' }))
			.mockResolvedValueOnce(
				json({
					done: true,
					response: {
						generateVideoResponse: { generatedSamples: [{ video: { uri: 'https://video.test' } }] },
					},
				})
			)
			.mockResolvedValueOnce(new Response('video'));
		await createGoogleVideoAdapter(spec).generate({
			modelId: 'veo-3.1',
			prompt: 'sunrise',
			options: { image: { bytesBase64Encoded: 'image' }, durationSeconds: 8 },
		});
		expect(fetch.mock.calls[0][0]).toBe(
			'https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning'
		);
		expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
			instances: [{ prompt: 'sunrise', image: { bytesBase64Encoded: 'image' } }],
			parameters: { durationSeconds: 8 },
		});
	});

	it('transcribes inline audio with Gemini 3.5 Transcribe', async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				json({ steps: [{ type: 'model_output', content: [{ type: 'text', text: 'hello' }] }] })
			);
		const result = await createGoogleSttAdapter(spec).transcribe({
			providerId: 'google',
			modelId: 'gemini-3.5-transcribe',
			audio,
			language: 'en',
		});
		expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
			model: 'gemini-3.5-transcribe',
			input: [{ type: 'audio', data: audio.data, mime_type: 'audio/wav' }],
			generation_config: { transcription_config: { language_codes: ['en'] } },
		});
		expect(result.text).toBe('hello');
	});

	it('uses the updated Gemini 3.8 voice contract and separates acting direction', async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				json({
					candidates: [
						{ content: { parts: [{ inlineData: { data: 'wav', mimeType: 'audio/wav' } }] } },
					],
				})
			);
		await createGoogleSpeechAdapter({
			...spec,
			baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
		}).synthesize({
			modelId: 'gemini-3.8-flash-tts',
			text: 'hello',
			options: { speechMetadata: { style: 'cheerful' } },
		});
		const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
		expect(body.contents[0].parts[0]).toEqual({
			text: 'hello',
			speech_metadata: { style: 'cheerful' },
		});
		expect(body.generationConfig.speechConfig.voiceConfig).toEqual({ voice: 'Kore' });
	});

	it('uses MiniMax H3 v2 task creation and direct result URLs', async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json({ task_id: 'job' }))
			.mockResolvedValueOnce(
				json({ task: { status: 'succeeded', content: { url: 'https://video.test' } } })
			)
			.mockResolvedValueOnce(new Response('video'));
		await createMinimaxVideoAdapter(spec).generate({
			modelId: 'MiniMax-H3',
			prompt: 'sunrise',
			options: { resolution: '2K' },
		});
		expect(fetch.mock.calls[0][0]).toBe('https://api.minimax.io/v2/video_generation');
		expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
			model: 'MiniMax-H3',
			resolution: '2K',
			duration: 5,
			ratio: '16:9',
			content: [{ type: 'text', text: 'sunrise' }],
		});
		expect(fetch.mock.calls[1][0]).toBe('https://api.minimax.io/v2/query/video_generation/job');
	});

	it('generates MiniMax image-01 from the image_generation contract', async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(
				json({ data: { image_urls: ['https://image.test'] }, base_resp: { status_code: 0 } })
			)
			.mockResolvedValueOnce(new Response('image'));
		await createMiniMaxImageAdapter(spec).generate({ modelId: 'image-01', prompt: 'cat' });
		expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
			model: 'image-01',
			prompt: 'cat',
			response_format: 'url',
		});
	});

	it('decodes MiniMax Music hex audio', async () => {
		jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json({ data: { audio: '6869' }, base_resp: { status_code: 0 } }));
		const result = await createMiniMaxMusicAdapter(spec).generate({
			modelId: 'music-3.0',
			prompt: 'jazz',
			options: { is_instrumental: true },
		});
		expect(result).toEqual({ base64: 'aGk=', mimeType: 'audio/mpeg' });
	});

	it('uploads MiniMax ASR audio and sends language as a header', async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json({ text: 'hello', duration: 1.5 }));
		const result = await createMiniMaxSttAdapter(spec).transcribe({
			providerId: 'minimax',
			modelId: 'asr-1.0',
			audio,
			language: 'en',
		});
		expect((fetch.mock.calls[0][1]?.body as FormData).get('model')).toBe('asr-1.0');
		expect(fetch.mock.calls[0][1]?.headers).toEqual({
			Authorization: 'Bearer key',
			language: 'en',
		});
		expect(result.metadata.usage?.durationSeconds).toBe(1.5);
	});

	it('uses the official Pika 2.5 API instead of the legacy fal route', async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json({ id: 'job', status: 'queued' }))
			.mockResolvedValueOnce(
				json({ id: 'job', status: 'completed', output: { video: { url: 'https://video.test' } } })
			)
			.mockResolvedValueOnce(new Response('video'));
		await createPikaVideoAdapter(spec).generate({ modelId: 'pika-2.5', prompt: 'sunrise' });
		expect(fetch.mock.calls[0][0]).toBe(
			'https://api.dev.pika.art/v1/media/pika/pika-2.5/text-to-video'
		);
		expect(fetch.mock.calls[0][1]?.headers).toEqual(
			expect.objectContaining({ 'X-API-Key': 'key' })
		);
	});

	it('polls Pika sound effects and reports failed jobs', async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json({ id: 'job', status: 'queued' }))
			.mockResolvedValueOnce(
				json({ id: 'job', status: 'completed', output: { audio: { url: 'https://audio.test' } } })
			)
			.mockResolvedValueOnce(new Response('audio', { headers: { 'content-type': 'audio/wav' } }));
		const result = await createPikaMusicAdapter(spec).generate({
			modelId: 'pika-sfx',
			prompt: 'rain',
		});
		expect(result.mimeType).toBe('audio/wav');
		fetch.mockResolvedValueOnce(
			json({ id: 'failed', status: 'failed', error: { message: 'Unavailable' } })
		);
		await expect(
			createPikaMusicAdapter(spec).generate({ modelId: 'pika-music', prompt: 'jazz' })
		).rejects.toThrow('Unavailable');
	});

	it('uses a documented Pika speech preset by default', async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json({ id: 'job', status: 'queued' }))
			.mockResolvedValueOnce(
				json({ id: 'job', status: 'completed', output: { audio: { url: 'https://audio.test' } } })
			)
			.mockResolvedValueOnce(new Response('audio'));
		await createPikaSpeechAdapter({ ...spec, baseURL: 'https://api.dev.pika.art' }).synthesize({
			modelId: 'pika-speech',
			text: 'hello',
		});
		expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
			script: 'hello',
			voice_preset: 'calm_documentary_narrator',
		});
	});

	it('submits Kling 3 using settings and polls the unified tasks API', async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json({ data: { id: 'job', status: 'submitted' } }))
			.mockResolvedValueOnce(
				json({
					data: [
						{
							id: 'job',
							status: 'succeeded',
							outputs: [{ type: 'video', url: 'https://video.test' }],
						},
					],
				})
			)
			.mockResolvedValueOnce(new Response('video'));
		await createKlingVideoAdapter(spec).generate({
			modelId: 'kling-3.0',
			prompt: 'sunrise',
			options: { settings: { resolution: '4k' } },
		});
		expect(fetch.mock.calls[0][0]).toBe(
			'https://api-singapore.klingai.com/text-to-video/kling-3.0'
		);
		expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
			prompt: 'sunrise',
			settings: { resolution: '4k' },
		});
		expect(fetch.mock.calls[1][0]).toBe('https://api-singapore.klingai.com/tasks?task_ids=job');
	});

	it('edits Kling Image Omni using image_list', async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json({ data: { task_id: 'job', task_status: 'submitted' } }))
			.mockResolvedValueOnce(
				json({
					data: {
						task_status: 'succeed',
						task_result: { images: [{ url: 'https://image.test' }] },
					},
				})
			)
			.mockResolvedValueOnce(new Response('image'));
		await createKlingImageAdapter(spec).generate({
			modelId: 'kling-v3-omni',
			prompt: 'edit',
			source,
		});
		expect(fetch.mock.calls[0][0]).toBe('https://api-singapore.klingai.com/v1/images/omni-image');
		expect(JSON.parse(String(fetch.mock.calls[0][1]?.body)).image_list).toEqual([
			{ image: source.base64 },
		]);
	});

	it('generates Kling audio using the documented mp3 result field', async () => {
		const fetch = jest
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(json({ data: { task_id: 'job', task_status: 'submitted' } }))
			.mockResolvedValueOnce(
				json({
					data: {
						task_status: 'succeed',
						task_result: { audios: [{ url_mp3: 'https://audio.test' }] },
					},
				})
			)
			.mockResolvedValueOnce(new Response('audio'));
		await createKlingMusicAdapter(spec).generate({ modelId: 'kling-audio', prompt: 'rain' });
		expect(fetch.mock.calls[1][0]).toBe(
			'https://api-singapore.klingai.com/v1/audio/text-to-audio/job'
		);
	});
});
