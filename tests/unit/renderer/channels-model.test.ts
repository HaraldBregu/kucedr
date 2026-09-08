import { loadChannelModelState } from '../../../src/renderer/src/pages/settings/pages/channels/load';
import {
	providers,
	providerIdsFor,
	providerModels,
	supportsSpeechToTextApiType,
} from '../../../src/renderer/src/lib/providers';

jest.mock('../../../src/renderer/src/lib/providers', () => ({
	providers: jest.fn(),
	providerIdsFor: jest.fn(),
	providerModels: jest.fn(),
	supportsSpeechToTextApiType: jest.fn(),
}));

const selection = jest.fn();
const listModels = jest.fn();
const provider = { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' };
const t = (key: string): string => key;

beforeEach(() => {
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: { getChannelsModelSelection: selection },
	});
	Object.defineProperty(window, 'models', {
		configurable: true,
		value: {
			transcribe: {
				listProviders: jest.fn().mockResolvedValue([provider]),
				listModels,
			},
		},
	});
	jest.mocked(providers).mockReturnValue([provider]);
	jest.mocked(providerIdsFor).mockReturnValue(['openai']);
	jest.mocked(providerModels).mockReturnValue([
		{ id: 'first', name: 'First' },
		{ id: 'selected', name: 'Selected' },
	]);
	selection.mockResolvedValue({ providerId: 'openai', modelId: 'selected' });
});

it.each(['llm', 'tts'] as const)('preserves the stored %s model selection', async (kind) => {
	expect(await loadChannelModelState(kind, t)).toMatchObject({
		providerId: 'openai',
		modelId: 'selected',
		loading: false,
		error: null,
	});
	expect(providerModels).toHaveBeenCalledWith('openai', kind === 'llm' ? 'llm' : 'text-to-speech');
});

it('excludes realtime-only transcription models and falls back to a batch model', async () => {
	selection.mockResolvedValue({ providerId: 'openai', modelId: 'realtime' });
	listModels.mockResolvedValue([
		{ id: 'realtime', name: 'Realtime' },
		{ id: 'batch', name: 'Batch' },
	]);
	jest.mocked(supportsSpeechToTextApiType).mockImplementation((_provider, id) => id === 'batch');
	const state = await loadChannelModelState('stt', t);
	expect(state.modelId).toBe('batch');
	expect(state.modelGroups[0].models).toEqual([{ id: 'batch', name: 'Batch' }]);
});

it('reports a saved-selection load failure', async () => {
	selection.mockRejectedValue(new Error('Could not load selection'));
	expect(await loadChannelModelState('llm', t)).toMatchObject({
		error: 'Could not load selection',
		loading: false,
		loadingModels: false,
	});
});
