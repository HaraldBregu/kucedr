const getVoiceModel = jest.fn();
const setVoiceModel = jest.fn();
const findModel = jest.fn();
const modelsFor = jest.fn();

jest.mock('../../../../src/main/agent/agent_store', () => ({ getVoiceModel, setVoiceModel }));
jest.mock('../../../../src/main/models', () => ({ findModel, modelsFor }));

import { getRealtimeVoiceSetup, setRealtimeVoiceSetup } from '../../../../src/main/models/realtime';

const openaiModel = {
	id: 'gpt-realtime',
	name: 'GPT Realtime',
	type: 'realtime-voice',
	provider: { id: 'openai', name: 'OpenAI' },
	metadata: {
		documentationStatus: 'verified',
		documentationUrl: '',
		inputs: {
			voice: { type: 'string', enum: ['marin', 'cedar'], default: 'marin' },
		},
	},
};

beforeEach(() => {
	jest.clearAllMocks();
	getVoiceModel.mockReturnValue({
		providerId: 'openai',
		modelId: 'gpt-realtime',
		options: { voice: 'unknown', temperature: 0.4 },
	});
	modelsFor.mockReturnValue([openaiModel]);
	findModel.mockImplementation((providerId, type, modelId) => {
		if (providerId !== 'openai' || type !== 'realtime-voice') return undefined;
		if (modelId === 'gpt-realtime') return openaiModel;
		return undefined;
	});
});

it('returns the catalog realtime models and canonical options', () => {
	expect(getRealtimeVoiceSetup()).toEqual({
		providerId: 'openai',
		modelId: 'gpt-realtime',
		options: { voice: 'marin', temperature: 0.4 },
		supportedModels: [{ providerId: 'openai', modelId: 'gpt-realtime' }],
	});
	expect(modelsFor).toHaveBeenCalledWith('realtime-voice');
	expect(setVoiceModel).not.toHaveBeenCalled();
});

it('canonicalizes the voice and writes the complete setup atomically', () => {
	const result = setRealtimeVoiceSetup({
		providerId: ' OPENAI ',
		modelId: ' gpt-realtime ',
		options: { voice: 'unsupported', temperature: 0.2 },
	});

	expect(setVoiceModel).toHaveBeenCalledTimes(1);
	expect(setVoiceModel).toHaveBeenCalledWith('realtimeVoice', {
		providerId: 'openai',
		modelId: 'gpt-realtime',
		options: { voice: 'marin', temperature: 0.2 },
	});
	expect(result.options).toEqual({ voice: 'marin', temperature: 0.2 });
});

it('rejects malformed provider and model values before catalog access', () => {
	expect(() =>
		setRealtimeVoiceSetup({ providerId: 42, modelId: 'gpt-realtime', options: {} } as never)
	).toThrow('Invalid realtime voice provider or model.');
	expect(findModel).not.toHaveBeenCalled();
	expect(setVoiceModel).not.toHaveBeenCalled();
});

it('rejects runtime model references missing from the realtime voice catalog', () => {
	expect(() =>
		setRealtimeVoiceSetup({
			providerId: 'openai',
			modelId: 'missing-realtime',
			options: {},
		})
	).toThrow('not available');
	expect(setVoiceModel).not.toHaveBeenCalled();
});
