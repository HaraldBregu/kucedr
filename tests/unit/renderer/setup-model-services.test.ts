import { act, renderHook } from '@testing-library/react';
import {
	loadModelServiceState,
	useSetupModelServices,
} from '../../../src/renderer/src/pages/start/hooks/useSetupModelServices';
import { createInitialModelServiceState } from '../../../src/renderer/src/pages/start/setupConstants';
import type { ModelServiceDefinition } from '../../../src/renderer/src/pages/start/setupTypes';
import type { SetupState } from '../../../src/renderer/src/pages/start/state/setupState';

const provider = { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' };
const model = { id: 'gpt-5', name: 'GPT-5' };
const modelGroups = [{ provider, models: [model] }];

const service: ModelServiceDefinition = {
	id: 'assistant',
	title: 'Assistant',
	description: 'Chat, reasoning, and planning.',
	getSelection: async () => undefined,
	loadModelGroups: async () => modelGroups,
	saveSelection: async () => true,
};

describe('onboarding model service state', () => {
	it('leaves a service empty when no model was previously selected', async () => {
		await expect(loadModelServiceState(service)).resolves.toEqual({
			providerId: '',
			modelId: '',
			modelGroups,
		});
	});

	it('restores a valid saved model selection', async () => {
		await expect(
			loadModelServiceState({
				...service,
				getSelection: async () => ({ providerId: provider.id, modelId: model.id }),
			})
		).resolves.toEqual({
			providerId: provider.id,
			modelId: model.id,
			modelGroups,
		});
	});

	it('includes configured Ollama models for the Assistant setup', async () => {
		Object.defineProperty(window, 'provider', {
			configurable: true,
			value: {
				list: jest.fn().mockResolvedValue([
					{
						id: 'custom',
						name: 'Ollama',
						apiKey: 'ollama',
						baseUrl: 'http://localhost:11434/api',
					},
				]),
				listCustomModels: jest.fn().mockResolvedValue(['llama3.2:3b']),
			},
		});

		const assistant = (await import('../../../src/renderer/src/pages/start/setupConstants'))
			.MODEL_SERVICE_DEFINITIONS.find((item) => item.id === 'assistant');
		expect(assistant).toBeDefined();
		await expect(assistant!.loadModelGroups()).resolves.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					provider: expect.objectContaining({ id: 'custom', name: 'Ollama' }),
					models: [{ id: 'llama3.2:3b', name: 'llama3.2:3b' }],
				}),
			])
		);
	});

	it('persists voice and transcription selections when they change', async () => {
		const voiceProvider = {
			id: 'elevenlabs',
			name: 'ElevenLabs',
			baseUrl: 'https://api.elevenlabs.io',
		};
		const voiceModel = { id: 'eleven_v3', name: 'Eleven v3' };
		const transcriptionProvider = {
			id: 'deepgram',
			name: 'Deepgram',
			baseUrl: 'https://api.deepgram.com/v1',
		};
		const transcriptionModel = { id: 'nova-3', name: 'Nova 3' };
		const setVoiceProviderId = jest.fn().mockResolvedValue(undefined);
		const setVoiceModelId = jest.fn().mockResolvedValue(undefined);
		const saveTranscriptionSelection = jest.fn().mockResolvedValue(true);
		Object.defineProperty(window, 'models', {
			configurable: true,
			value: {
				voice: {
					setProviderId: setVoiceProviderId,
					setModelId: setVoiceModelId,
				},
				transcribe: { saveSelection: saveTranscriptionSelection },
			},
		});

		const serviceStates = createInitialModelServiceState();
		serviceStates.voice = {
			providerId: '',
			modelId: '',
			modelGroups: [{ provider: voiceProvider, models: [voiceModel] }],
		};
		serviceStates.transcription = {
			providerId: '',
			modelId: '',
			modelGroups: [{ provider: transcriptionProvider, models: [transcriptionModel] }],
		};
		const state: SetupState = {
			step: 'modelProvider',
			serviceStates,
			loadingModels: false,
			savingConfig: false,
			errorMessage: '',
		};
		const dispatch = jest.fn();
		const { result } = renderHook(() => useSetupModelServices(state, dispatch));

		await act(async () => {
			await result.current.handleServiceChange('voice', voiceProvider.id, voiceModel.id);
			await result.current.handleServiceChange(
				'transcription',
				transcriptionProvider.id,
				transcriptionModel.id
			);
		});

		expect(setVoiceProviderId).toHaveBeenCalledWith(voiceProvider.id);
		expect(setVoiceModelId).toHaveBeenCalledWith(voiceModel.id);
		expect(saveTranscriptionSelection).toHaveBeenCalledWith(
			transcriptionProvider.id,
			transcriptionModel.id
		);
	});
});
