const stores = new Map<string, Record<string, unknown>>();

jest.mock('electron-store', () =>
	jest.fn().mockImplementation((options: { name?: string }) => {
		const name = options.name ?? 'config';
		let backing = stores.get(name) ?? {
			providerId: 'openai',
			modelId: 'gpt-5',
			modelOptions: { reasoning: 'high' },
			search_engine: { providerId: 'brave', providerName: 'Brave', enabled: true },
			image_model: { providerId: 'openai', modelId: 'image-1', options: {} },
			audio_model: { providerId: 'elevenlabs', modelId: 'sound-1', options: {} },
			video_model: { providerId: 'google', modelId: 'veo-3', options: {} },
			tools: {
				read_file: { enabled: false, permission: 'ask' },
				list_apps: { enabled: true, permission: 'allow' },
				open_apps: { enabled: true, permission: 'allow' },
				close_apps: { enabled: true, permission: 'allow' },
			},
			voice_model: { providerId: 'openai', modelId: 'tts-1', options: { voice: 'alloy' } },
			transcription_model: { providerId: 'deepgram', modelId: 'nova-3', options: {} },
			realtime_voice_model: { providerId: 'openai', modelId: 'realtime-1', options: {} },
			permissions: {
				read: { allow: [], deny: [] },
				write: { allow: [], deny: [] },
				exec: { allow: [], deny: [] },
				tools: { save_memory: 'allow', list_memories: 'allow', forget_memory: 'allow' },
			},
		};
		stores.set(name, backing);
		return {
			path: `/tmp/kucedr-settings/${name}.json`,
			get: (key: string) => backing[key],
			set: (key: string, value: unknown) => {
				backing[key] = value;
			},
			get store() {
				return backing;
			},
			set store(value: Record<string, unknown>) {
				backing = value;
				stores.set(name, value);
			},
		};
	})
);

import { getProviderId } from '../../../../src/main/agent/agent_store';
import {
	agentProfileStorePath,
	getAgentProfileDocument,
	getAgentProfileModel,
	setAgentProfileModel,
} from '../../../../src/main/agent/agent_profiles';

it('creates clean independent agent profile stores without migration metadata', () => {
	expect(getProviderId()).toBeUndefined();
	expect(getAgentProfileModel('chat', 'textToText')).toEqual({
		providerId: '',
		modelId: '',
		options: {},
	});
	expect(getAgentProfileModel('chat', 'textToSpeech')).toEqual({
		providerId: '',
		modelId: '',
		options: {},
	});
	expect(getAgentProfileModel('voice', 'realtimeVoice')).toEqual({
		providerId: '',
		modelId: '',
		options: {},
	});
	expect(stores.get('chat')).not.toHaveProperty('schemaVersion');
	expect(stores.get('chat')).not.toHaveProperty('migrations');
	expect(agentProfileStorePath('chat')).toMatch(/chat\.json$/);
	expect(agentProfileStorePath('voice')).toMatch(/voice\.json$/);
	expect(agentProfileStorePath('tasks')).toMatch(/tasks\.json$/);
	expect(agentProfileStorePath('health')).toMatch(/health\.json$/);
	expect(agentProfileStorePath('channels')).toMatch(/channels\.json$/);
});

it('keeps model selections isolated between agent profiles', () => {
	setAgentProfileModel('chat', 'textToText', {
		providerId: 'openai',
		modelId: 'gpt-5',
		options: {},
	});
	setAgentProfileModel('chat', 'textToSpeech', {
		providerId: 'openai',
		modelId: 'gpt-4o-mini-tts',
		options: {},
	});
	setAgentProfileModel('chat', 'speechToText', {
		providerId: 'openai',
		modelId: 'gpt-4o-transcribe',
		options: {},
	});
	setAgentProfileModel('tasks', 'textToText', {
		providerId: 'anthropic',
		modelId: 'claude-sonnet-4',
		options: { temperature: 0.1 },
	});

	expect(getAgentProfileModel('tasks', 'textToText')).toEqual({
		providerId: 'anthropic',
		modelId: 'claude-sonnet-4',
		options: { temperature: 0.1 },
	});
	expect(getAgentProfileDocument('tasks')).toMatchObject({
		llm: { providerId: 'anthropic', modelId: 'claude-sonnet-4' },
	});
	expect(getAgentProfileDocument('tasks')).not.toHaveProperty('textToText');
	expect(getAgentProfileDocument('tasks')).not.toHaveProperty('textToSpeech');
	expect(getAgentProfileDocument('tasks')).not.toHaveProperty('speechToText');
	expect(getAgentProfileDocument('tasks')).not.toHaveProperty('realtimeVoice');
	expect(getAgentProfileDocument('chat')).toMatchObject({
		llm: { providerId: 'openai', modelId: 'gpt-5' },
		tts: { providerId: 'openai', modelId: 'gpt-4o-mini-tts' },
		stt: { providerId: 'openai', modelId: 'gpt-4o-transcribe' },
	});
	expect(getAgentProfileDocument('chat')).not.toHaveProperty('textToText');
	expect(getAgentProfileDocument('chat')).not.toHaveProperty('textToSpeech');
	expect(getAgentProfileDocument('chat')).not.toHaveProperty('speechToText');
	expect(getAgentProfileDocument('chat')).not.toHaveProperty('realtimeVoice');
	setAgentProfileModel('health', 'textToText', {
		providerId: 'openai',
		modelId: 'gpt-5-mini',
		options: {},
	});
	expect(getAgentProfileDocument('health')).toMatchObject({
		llm: { providerId: 'openai', modelId: 'gpt-5-mini' },
	});
	expect(getAgentProfileDocument('health')).not.toHaveProperty('textToText');
	expect(getAgentProfileDocument('health')).not.toHaveProperty('textToSpeech');
	expect(getAgentProfileDocument('health')).not.toHaveProperty('speechToText');
	expect(getAgentProfileDocument('health')).not.toHaveProperty('realtimeVoice');
	setAgentProfileModel('channels', 'textToText', {
		providerId: 'openai',
		modelId: 'gpt-5-mini',
		options: {},
	});
	setAgentProfileModel('channels', 'textToSpeech', {
		providerId: 'openai',
		modelId: 'gpt-4o-mini-tts',
		options: {},
	});
	setAgentProfileModel('channels', 'speechToText', {
		providerId: 'openai',
		modelId: 'gpt-4o-transcribe',
		options: {},
	});
	expect(getAgentProfileDocument('channels')).toMatchObject({
		llm: { providerId: 'openai', modelId: 'gpt-5-mini' },
		tts: { providerId: 'openai', modelId: 'gpt-4o-mini-tts' },
		stt: { providerId: 'openai', modelId: 'gpt-4o-transcribe' },
	});
	expect(getAgentProfileDocument('channels')).not.toHaveProperty('realtimeVoice');
	expect(getAgentProfileDocument('channels')).not.toHaveProperty('image');
	expect(getAgentProfileDocument('channels')).not.toHaveProperty('audio');
	expect(getAgentProfileDocument('channels')).not.toHaveProperty('video');
});
