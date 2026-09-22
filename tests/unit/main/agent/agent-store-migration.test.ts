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
				if (name === 'agent') persisted = value;
			},
		};
	})
);

import { getProviderId } from '../../../../src/main/agent/agent_store';
import {
	agentProfileStorePath,
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
	expect(stores.get('chat-agent')).not.toHaveProperty('schemaVersion');
	expect(stores.get('chat-agent')).not.toHaveProperty('migrations');
	expect(agentProfileStorePath('chat')).toMatch(/chat-agent\.json$/);
	expect(agentProfileStorePath('tasks')).toMatch(/tasks\.json$/);
	expect(agentProfileStorePath('health')).toMatch(/health\.json$/);
	expect(agentProfileStorePath('channels')).toMatch(/channels\.json$/);
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
		providerId: '',
		modelId: '',
	});
});
