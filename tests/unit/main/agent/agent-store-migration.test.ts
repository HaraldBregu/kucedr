let persisted: Record<string, unknown> = {};
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
				if (name === 'agent') persisted = value;
			},
		};
	})
);

import { getProviderId, getToolProfile } from '../../../../src/main/agent/agent_store';
import {
	agentProfileStorePath,
	getAgentProfileModel,
	setAgentProfileModel,
} from '../../../../src/main/agent/agent_profiles';

it('migrates legacy agent settings into independent agent profile stores', () => {
	expect(getProviderId()).toBe('openai');
	expect(getAgentProfileModel('chat', 'textToText')).toEqual({
		providerId: 'openai',
		modelId: 'gpt-5',
		options: { reasoning: 'high' },
	});
	expect(getAgentProfileModel('chat', 'textToSpeech')).toEqual({
		providerId: 'openai',
		modelId: 'tts-1',
		options: { voice: 'alloy' },
	});
	expect(getAgentProfileModel('voice', 'realtimeVoice')).toEqual({
		providerId: 'openai',
		modelId: 'realtime-1',
		options: {},
	});
	expect(getToolProfile('health').tools.read).toEqual({ enabled: false, permission: 'ask' });
	expect(stores.get('chat-agent')).toMatchObject({
		textToText: { providerId: 'openai', modelId: 'gpt-5' },
		tools: { read: { enabled: false, permission: 'ask' } },
	});
	expect(stores.get('voice-agent')).toMatchObject({
		realtimeVoice: { providerId: 'openai', modelId: 'realtime-1' },
	});
	expect(agentProfileStorePath('chat')).toMatch(/chat-agent\.json$/);
	expect(persisted).not.toHaveProperty('providerId');
	expect(persisted).not.toHaveProperty('modelId');
	expect(persisted).not.toHaveProperty('modelOptions');
	expect(persisted).not.toHaveProperty('search_engine');
	expect(persisted).not.toHaveProperty('image_model');
	expect(persisted).not.toHaveProperty('audio_model');
	expect(persisted).not.toHaveProperty('video_model');
	expect(persisted).not.toHaveProperty('voice_model');
	expect(persisted).not.toHaveProperty('large_language_model');
	expect(persisted).not.toHaveProperty('text_to_speech_model');
	expect(persisted).not.toHaveProperty('transcription_model');
	expect(persisted.tools).not.toHaveProperty('save_memory');
	expect(persisted.tools).not.toHaveProperty('list_memories');
	expect(persisted.tools).not.toHaveProperty('forget_memory');
	expect(persisted.tools).not.toHaveProperty('list_apps');
	expect(persisted.tools).not.toHaveProperty('open_apps');
	expect(persisted.tools).not.toHaveProperty('close_apps');
});

it('keeps model selections isolated between agent profiles', () => {
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
	expect(getAgentProfileModel('chat', 'textToText')).toMatchObject({
		providerId: 'openai',
		modelId: 'gpt-5',
	});
});
