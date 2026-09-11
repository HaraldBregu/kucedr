jest.mock('electron-store', () =>
	jest.fn().mockImplementation((options: { defaults?: unknown }) => {
		let backing = structuredClone(options.defaults ?? {}) as Record<string, unknown>;
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
			},
		};
	})
);

import {
	AGENT_DIRECTORY,
	addPermissionRule,
	getToolModel,
	getChatbotModel,
	getModelId,
	getPermissions,
	getProviderId,
	resetPermissions,
	setToolModel,
	setChatbotModel,
	setModelId,
	setPermissions,
	setProviderId,
} from '../../../../../src/main/agent/agent_store';

const workspaceRule = `${AGENT_DIRECTORY.replaceAll('\\', '/')}/**`;

beforeEach(() => resetPermissions());

describe('agent store permissions', () => {
	it('trusts the workspace recursively for every filesystem capability', () => {
		expect(resetPermissions()).toEqual({
			read: { allow: [workspaceRule], deny: [] },
			write: { allow: [workspaceRule], deny: [] },
			exec: { allow: [workspaceRule], deny: [] },
		});
	});

	it('normalizes rules and never removes the workspace grant', () => {
		const saved = setPermissions({
			read: { allow: [' /repo/** ', '/repo/**'], deny: [] },
			write: { allow: [], deny: ['/blocked/**'] },
			exec: { allow: [], deny: [] },
		});
		expect(saved.read.allow).toEqual([workspaceRule, '/repo/**']);
		expect(saved.write.allow).toEqual([workspaceRule]);
		expect(saved.exec.allow).toEqual([workspaceRule]);
	});

	it('preserves explicit blocked rules inside the workspace', () => {
		const saved = setPermissions({
			read: { allow: [], deny: [`${AGENT_DIRECTORY}/private/**`] },
			write: { allow: [], deny: [`${AGENT_DIRECTORY}/private/**`] },
			exec: { allow: [], deny: [`${AGENT_DIRECTORY}/private/**`] },
		});
		expect(saved.read.deny).toEqual([`${AGENT_DIRECTORY}/private/**`]);
		expect(saved.write.deny).toEqual([`${AGENT_DIRECTORY}/private/**`]);
		expect(saved.exec.deny).toEqual([`${AGENT_DIRECTORY}/private/**`]);
	});

	it('preserves an execute ancestor grant and its explicit blocked child', () => {
		const saved = setPermissions({
			read: { allow: [], deny: [] },
			write: { allow: [], deny: [] },
			exec: { allow: ['/shared/**'], deny: ['/shared/private/**'] },
		});
		expect(saved.exec).toEqual({
			allow: [workspaceRule, '/shared/**'],
			deny: ['/shared/private/**'],
		});
	});

	it('adds a rule without changing other buckets', () => {
		addPermissionRule('exec', 'allow', '/repo/**');
		expect(getPermissions().exec.allow).toEqual([workspaceRule, '/repo/**']);
		expect(getPermissions().read.allow).toEqual([workspaceRule]);
	});

	it('preserves unrelated agent settings', () => {
		setProviderId('provider');
		setModelId('model');
		setToolModel('image', { providerId: 'google', modelId: 'image', options: {} });
		setPermissions({
			read: { allow: [], deny: [] },
			write: { allow: [], deny: [] },
			exec: { allow: [], deny: [] },
		});
		expect(getProviderId()).toBe('provider');
		expect(getModelId()).toBe('model');
		expect(getToolModel('image')).toMatchObject({ providerId: 'google', modelId: 'image' });
	});

	it('keeps chat and tool speech selections independent', () => {
		setChatbotModel('voice', {
			providerId: 'openai',
			modelId: 'gpt-4o-mini-tts',
			options: { voice: 'marin' },
		});
		setToolModel('textToSpeech', {
			providerId: 'elevenlabs',
			modelId: 'eleven_v3',
			options: { voice_id: 'eve' },
		});
		setToolModel('speechToText', {
			providerId: 'deepgram',
			modelId: 'nova-3',
			options: {},
		});

		expect(getChatbotModel('voice')).toMatchObject({ providerId: 'openai' });
		expect(getToolModel('textToSpeech')).toMatchObject({ providerId: 'elevenlabs' });
		expect(getToolModel('speechToText')).toMatchObject({ providerId: 'deepgram' });
	});
});
