const generateImage = jest.fn();
const generateVideo = jest.fn();
const generateMusic = jest.fn();
const getProviderId = jest.fn();
const getModelId = jest.fn();
const resolveOptions = jest.fn();
const providerModels = jest.fn();

class ProviderError extends Error {}

jest.mock('../../../../src/main/models', () => ({
	loadProviders: () => [],
	findModel: (providerId: string, _type: string, modelId: string) => ({
		id: modelId, provider: { id: providerId, baseUrl: '' }, url: 'https://example.test',
	}),
	providerModels,
	supportsCapability: () => true,
}));
jest.mock('../../../../src/main/settings_store', () => ({
	getProvider: () => ({ name: 'Provider', apiKey: 'secret' }),
}));
jest.mock('../../../../src/main/models/selection', () => ({
	getProviderId,
	getModelId,
	resolveOptions,
}));
jest.mock('../../../../src/main/models/adapters/tti', () => ({
	generateImage,
	ImageProviderAuthError: ProviderError,
	ImageProviderRequestError: ProviderError,
	ImageProviderUnsupportedError: ProviderError,
}));
jest.mock('../../../../src/main/models/adapters/ttv', () => ({
	generateVideo,
	VideoProviderAuthError: ProviderError,
	VideoProviderRequestError: ProviderError,
	VideoProviderUnsupportedError: ProviderError,
}));
jest.mock('../../../../src/main/models/adapters/tta', () => ({
	generateMusic,
	MusicProviderAuthError: ProviderError,
	MusicProviderRequestError: ProviderError,
	MusicProviderUnsupportedError: ProviderError,
}));

import { createImage } from '../../../../src/main/models/image/image_create';
import { createSound } from '../../../../src/main/models/sound/sound_create';
import { createVideo } from '../../../../src/main/models/video/video_create';

beforeEach(() => {
	jest.clearAllMocks();
	getProviderId.mockImplementation((kind: string) => `${kind}-provider`);
	getModelId.mockImplementation((kind: string) => `${kind}-model`);
	providerModels.mockImplementation((providerId: string) => [
		{ id: providerId.replace(/-provider$/, '-model') },
	]);
	resolveOptions.mockImplementation(
		(
			_kind: string,
			_providerId: string,
			_modelId: string,
			overrides?: Record<string, unknown>
		) => ({ stored: true, ...overrides })
	);
	generateImage.mockResolvedValue({ base64: 'image', mimeType: 'image/png' });
	generateVideo.mockResolvedValue({ base64: 'video', mimeType: 'video/mp4' });
	generateMusic.mockResolvedValue({ base64: 'audio', mimeType: 'audio/mpeg' });
});

it('passes agent image defaults and request overrides to image generation', async () => {
	const source = { base64: 'aGVsbG8=', mimeType: 'image/png' as const };
	await createImage({ prompt: 'cat', source, options: { imageSize: '2K' } });

	expect(resolveOptions).toHaveBeenCalledWith('image', 'image-provider', 'image-model', {
		imageSize: '2K',
	});
	expect(generateImage).toHaveBeenCalledWith(
		expect.objectContaining({ source, options: { stored: true, imageSize: '2K' } })
	);
});

it('passes agent audio defaults and request overrides to sound generation', async () => {
	await createSound({ prompt: 'rain', options: { duration_seconds: 10 } });

	expect(resolveOptions).toHaveBeenCalledWith('sound', 'sound-provider', 'sound-model', {
		duration_seconds: 10,
	});
	expect(generateMusic).toHaveBeenCalledWith(
		expect.objectContaining({ options: { stored: true, duration_seconds: 10 } })
	);
});

it('passes agent video defaults and request overrides to video generation', async () => {
	await createVideo({ prompt: 'sunrise', options: { duration: 8 } });

	expect(resolveOptions).toHaveBeenCalledWith('video', 'video-provider', 'video-model', {
		duration: 8,
	});
	expect(generateVideo).toHaveBeenCalledWith(
		expect.objectContaining({ options: { stored: true, duration: 8 } })
	);
});

it('replaces a stale video model selection with the current catalog default', async () => {
	getModelId.mockReturnValue('gen4_turbo');
	providerModels.mockReturnValue([{ id: 'gen4.5' }]);

	await createVideo({ prompt: 'sunrise' });

	expect(generateVideo).toHaveBeenCalledWith(
		expect.objectContaining({ providerId: 'video-provider', modelId: 'gen4.5' })
	);
});
