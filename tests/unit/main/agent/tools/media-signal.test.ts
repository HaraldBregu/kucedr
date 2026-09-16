const createImage = jest.fn();
const createVideo = jest.fn();
const createSound = jest.fn();
const synthesize = jest.fn();
const saveMedia = jest.fn();

jest.mock('../../../../../src/main/agent/agent_store', () => ({
	getToolModel: jest.fn(() => ({
		providerId: 'openai',
		modelId: 'gpt-4o-mini-tts',
		options: { voice: 'cedar' },
	})),
}));

jest.mock('../../../../../src/main/models/image', () => ({ createImage }));
jest.mock('../../../../../src/main/models/video', () => ({ createVideo }));
jest.mock('../../../../../src/main/models/sound', () => ({ createSound }));
jest.mock('../../../../../src/main/models/voice', () => ({ synthesize }));
jest.mock('../../../../../src/main/agent/tools/media/save', () => ({ saveMedia }));

import { createImageTool } from '../../../../../src/main/agent/tools/media/create_image';
import { createSoundTool } from '../../../../../src/main/agent/tools/media/create_sound';
import { createVideoTool } from '../../../../../src/main/agent/tools/media/create_video';
import { textToSpeechTool } from '../../../../../src/main/agent/tools/media/text_to_speech';

beforeEach(() => {
	jest.clearAllMocks();
	createImage.mockResolvedValue({ base64: 'aW1hZ2U=', mimeType: 'image/png' });
	createVideo.mockResolvedValue({ base64: 'dmlkZW8=', mimeType: 'video/mp4' });
	createSound.mockResolvedValue({ base64: 'c291bmQ=', mimeType: 'audio/mpeg' });
	synthesize.mockResolvedValue({ audio: 'c3BlZWNo', mimeType: 'audio/mpeg' });
	saveMedia.mockResolvedValue('/tmp/generated');
});

it('uses the tool text-to-speech selection and propagates the run signal', async () => {
	const controller = new AbortController();
	await textToSpeechTool().run({ text: 'Say this' }, controller.signal);

	expect(synthesize).toHaveBeenCalledWith(
		{
			text: 'Say this',
			providerId: 'openai',
			modelId: 'gpt-4o-mini-tts',
			options: { voice: 'cedar' },
		},
		'tool'
	);
	expect(saveMedia).toHaveBeenCalledWith(
		'speech',
		'mp3',
		expect.any(String),
		undefined,
		controller.signal
	);
});

it.each([
	['image', createImageTool, createImage, 'png'],
	['video', createVideoTool, createVideo, 'mp4'],
	['sound', createSoundTool, createSound, 'mp3'],
] as const)(
	'propagates the run signal through %s generation and saving',
	async (kind, factory, create, extension) => {
		const controller = new AbortController();
		await factory().run({ prompt: 'generate this' }, controller.signal);

		expect(create).toHaveBeenCalledWith({ prompt: 'generate this' }, controller.signal);
		expect(saveMedia).toHaveBeenCalledWith(
			kind,
			extension,
			expect.any(String),
			undefined,
			controller.signal
		);
	}
);

it('generates and saves each requested image', async () => {
	createImage
		.mockResolvedValueOnce({ base64: 'aW1hZ2UtMQ==', mimeType: 'image/png' })
		.mockResolvedValueOnce({ base64: 'aW1hZ2UtMg==', mimeType: 'image/jpeg' });
	saveMedia.mockResolvedValueOnce('/tmp/image-1.png').mockResolvedValueOnce('/tmp/image-2.jpg');

	await expect(createImageTool().run({ prompt: 'generate this', count: 2 })).resolves.toEqual({
		path: '/tmp/image-1.png',
		mimeType: 'image/png',
		images: [
			{ path: '/tmp/image-1.png', mimeType: 'image/png' },
			{ path: '/tmp/image-2.jpg', mimeType: 'image/jpeg' },
		],
	});
	expect(createImage).toHaveBeenNthCalledWith(1, { prompt: 'generate this' }, undefined);
	expect(createImage).toHaveBeenNthCalledWith(2, { prompt: 'generate this' }, undefined);
	expect(saveMedia).toHaveBeenNthCalledWith(
		1,
		'image-1',
		'png',
		'aW1hZ2UtMQ==',
		undefined,
		undefined
	);
	expect(saveMedia).toHaveBeenNthCalledWith(
		2,
		'image-2',
		'jpeg',
		'aW1hZ2UtMg==',
		undefined,
		undefined
	);
});

it('limits image count from one to eight', () => {
	const tool = createImageTool();
	expect(tool.parseInput({ prompt: 'generate this' })).toMatchObject({ count: 1 });
	expect(tool.parseInput({ prompt: 'generate this', count: 8 })).toMatchObject({ count: 8 });
	expect(() => tool.parseInput({ prompt: 'generate this', count: 0 })).toThrow();
	expect(() => tool.parseInput({ prompt: 'generate this', count: 9 })).toThrow();
	expect(() => tool.parseInput({ prompt: 'generate this', count: 1.5 })).toThrow();
});
