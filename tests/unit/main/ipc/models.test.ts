const registerCommandWithEvent = jest.fn();
const registerQueryWithEvent = jest.fn();
const getModelId = jest.fn();
const getOptions = jest.fn();
const getProviderId = jest.fn();
const setModelId = jest.fn();
const setOptions = jest.fn();
const setProviderId = jest.fn();
const getRealtimeVoiceSetup = jest.fn();
const setRealtimeVoiceSetup = jest.fn();

jest.mock('../../../../src/main/ipc/core/gateway', () => ({
	registerCommandWithEvent,
	registerQueryWithEvent,
}));
jest.mock('../../../../src/main/models/index', () => ({
	embedding: { createEmbedding: jest.fn() },
	image: { createImage: jest.fn() },
	sound: { createSound: jest.fn(), listSounds: jest.fn(), saveSoundFile: jest.fn() },
	text: { generateText: jest.fn() },
	video: { createVideo: jest.fn(), saveVideoFile: jest.fn() },
	voice: { synthesize: jest.fn() },
}));
jest.mock('../../../../src/main/models/selection', () => ({
	getModelId,
	getOptions,
	getProviderId,
	setModelId,
	setOptions,
	setProviderId,
}));
jest.mock('../../../../src/main/models/adapters/stt', () => ({
	appendRealtimeAudio: jest.fn(),
	cancelRealtime: jest.fn(),
	finishRealtime: jest.fn(),
	getSelection: jest.fn(),
	listModels: jest.fn(),
	listProviders: jest.fn(),
	saveSelection: jest.fn(),
	startRealtime: jest.fn(),
	transcribe: jest.fn(),
}));
jest.mock('../../../../src/main/agent/realtime_voice/setup', () => ({
	getRealtimeVoiceSetup,
	setRealtimeVoiceSetup,
}));

import { ModelsIpc } from '../../../../src/main/ipc/models';
import { RealtimeVoiceChannels } from '../../../../src/shared/ipc_channels_definitions';
import { BrowserWindow } from 'electron';

let event: Record<string, unknown>;
const appHas = jest.fn(() => false);

function command(channel: string): (...args: unknown[]) => unknown {
	const handler = registerCommandWithEvent.mock.calls.find(
		([registered]) => registered === channel
	)?.[1];
	return (...args: unknown[]) => handler(event, ...args);
}

function query(channel: string): (...args: unknown[]) => unknown {
	const handler = registerQueryWithEvent.mock.calls.find(
		([registered]) => registered === channel
	)?.[1];
	return (...args: unknown[]) => handler(event, ...args);
}

beforeEach(() => {
	jest.clearAllMocks();
	appHas.mockReturnValue(false);
	const mainFrame = {};
	const sender = { mainFrame };
	event = { sender, senderFrame: mainFrame };
	jest
		.mocked(BrowserWindow.fromWebContents)
		.mockReturnValue({ id: 1, webContents: sender } as never);
	new ModelsIpc().register(
		{ windows: { has: () => true } as never, apps: { has: appHas } as never },
		{} as never
	);
});

it('wires realtime voice selection and options to their distinct model kind', () => {
	getOptions.mockReturnValue({ voice: 'marin' });
	command(RealtimeVoiceChannels.setProviderId)(' openai ');
	command(RealtimeVoiceChannels.setModelId)(' gpt-realtime-2.1 ');
	const result = command(RealtimeVoiceChannels.setOptions)({ voice: 'cedar' });

	expect(setProviderId).toHaveBeenCalledWith('realtimeVoice', 'openai');
	expect(setModelId).toHaveBeenCalledWith('realtimeVoice', 'gpt-realtime-2.1');
	expect(setOptions).toHaveBeenCalledWith('realtimeVoice', { voice: 'cedar' });
	expect(result).toEqual({ voice: 'marin' });
});

it('registers the atomic realtime voice setup API', () => {
	const setup = { options: {}, supportedModels: [] };
	const request = { providerId: 'openai', modelId: 'gpt-realtime', options: {} };
	getRealtimeVoiceSetup.mockReturnValue(setup);
	setRealtimeVoiceSetup.mockReturnValue({ ...setup, ...request });

	expect(query(RealtimeVoiceChannels.getSetup)()).toBe(setup);
	expect(command(RealtimeVoiceChannels.setSetup)(request)).toEqual({ ...setup, ...request });
	expect(setRealtimeVoiceSetup).toHaveBeenCalledWith(request);
});

it('rejects unsafe realtime voice selection inputs in main', () => {
	expect(() => command(RealtimeVoiceChannels.setProviderId)(null)).toThrow(
		'Invalid realtime voice provider id.'
	);
	expect(() => command(RealtimeVoiceChannels.setModelId)([])).toThrow(
		'Invalid realtime voice model id.'
	);
	expect(() => command(RealtimeVoiceChannels.setOptions)('marin')).toThrow(
		'Invalid realtime voice options.'
	);
});

it('allows model operations from registered app renderers', () => {
	appHas.mockReturnValue(true);
	const setup = { options: {}, supportedModels: [] };
	getRealtimeVoiceSetup.mockReturnValue(setup);

	expect(query(RealtimeVoiceChannels.getSetup)()).toBe(setup);
});

it('rejects model operations from unregistered renderers', () => {
	jest.mocked(BrowserWindow.fromWebContents).mockReturnValue(null);

	expect(() => query(RealtimeVoiceChannels.getSetup)()).toThrow(
		'Privileged IPC is unavailable to this renderer.'
	);
});
