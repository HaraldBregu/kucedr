let persisted: Record<string, unknown> = {};

jest.mock('electron-store', () =>
	jest.fn().mockImplementation(() => {
		let backing: Record<string, unknown> = {
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
				persisted = value;
			},
		};
	})
);

import '../../../../src/main/agent/agent_store';

it('migrates legacy agent settings into chatbot and tools branches', () => {
	expect(persisted).toMatchObject({
		chatbot: {
			textToText: {
				providerId: 'openai',
				modelId: 'gpt-5',
				options: { reasoning: 'high' },
			},
			textToSpeech: {
				providerId: 'openai',
				modelId: 'tts-1',
				options: { voice: 'alloy' },
			},
			speechToText: { providerId: 'deepgram', modelId: 'nova-3', options: {} },
		},
		voice: {
			realtimeVoice: { providerId: 'openai', modelId: 'realtime-1', options: {} },
		},
		tools: {
			webSearch: { providerId: 'brave', providerName: 'Brave', enabled: true },
			create_image: { providerId: 'openai', modelId: 'image-1', options: {} },
			create_sound: { providerId: 'elevenlabs', modelId: 'sound-1', options: {} },
			create_video: { providerId: 'google', modelId: 'veo-3', options: {} },
		},
		toolProfiles: {
			chat: { tools: { read: { enabled: false, permission: 'ask' } } },
			voice: { tools: { read: { enabled: false, permission: 'ask' } } },
			tasks: { tools: { read: { enabled: false, permission: 'ask' } } },
			health: { tools: { read: { enabled: false, permission: 'ask' } } },
			channels: { tools: { read: { enabled: false, permission: 'ask' } } },
		},
	});
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
