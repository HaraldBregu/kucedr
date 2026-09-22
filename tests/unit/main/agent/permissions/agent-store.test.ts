const mockStoreNames: string[] = [];

jest.mock('electron-store', () =>
	jest.fn().mockImplementation((options: { name?: string; defaults?: unknown }) => {
		mockStoreNames.push(options.name ?? 'config');
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
	getChatbotModel,
	getToolModel,
	getVoiceModel,
	getModelId,
	getPermissions,
	getProviderId,
	getToolConfiguration,
	getToolProfile,
	resetPermissions,
	setToolModel,
	setToolProfileTool,
	setChatbotModel,
	setVoiceModel,
	setModelId,
	setPermissions,
	setProviderId,
} from '../../../../../src/main/agent/agent_store';
import { getAgentProfileDocument } from '../../../../../src/main/agent/agent_profiles';
import { setAgentProfileTool } from '../../../../../src/main/agent/agent_profiles';

const workspaceRule = `${AGENT_DIRECTORY.replaceAll('\\', '/')}/**`;

beforeEach(() => {
	for (const profileId of ['chat', 'voice', 'health', 'tasks'] as const) {
		resetPermissions(profileId);
	}
});

describe('agent store permissions', () => {
	it('keeps model fields on media tool configurations', () => {
		expect(getToolModel('image')).toMatchObject({
			providerId: '',
			modelId: '',
			options: {},
		});
	});

	it.each(['chat', 'voice', 'tasks', 'channels'] as const)(
		'stores media models independently in the %s profile',
		(profileId) => {
			setToolModel(
				'image',
				{ providerId: 'google', modelId: `${profileId}-image`, options: {} },
				profileId
			);

			expect(getToolModel('image', profileId)).toMatchObject({
				providerId: 'google',
				modelId: `${profileId}-image`,
			});
		}
	);

	it('trusts the workspace recursively for every filesystem capability', () => {
		expect(resetPermissions()).toMatchObject({
			read: { allow: [workspaceRule], deny: [] },
			write: { allow: [workspaceRule], deny: [] },
			exec: { allow: [workspaceRule], deny: [] },
			tools: {},
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

	it('keeps per-tool permission choices with the chat profile', () => {
		const saved = setPermissions({
			read: { allow: [], deny: [] },
			write: { allow: [], deny: [] },
			exec: { allow: [], deny: [] },
			tools: {
				read: { permission: 'ask' },
				edit: { permission: 'allow' },
				patch: { permission: 'deny' },
			},
		});

		expect(saved.tools).toMatchObject({
			read: { permission: 'ask' },
			edit: { permission: 'allow' },
			patch: { permission: 'deny' },
		});
	});

	it.each(['chat', 'voice', 'health', 'tasks'] as const)(
		'stores %s permissions in its agent profile',
		(profileId) => {
			const rule = `/${profileId}/**`;
			setPermissions(
				{
					read: { allow: [rule], deny: [] },
					write: { allow: [], deny: [] },
					exec: { allow: [], deny: [] },
					tools: { read: { permission: 'ask' } },
				},
				profileId
			);

			expect(getAgentProfileDocument(profileId)).toMatchObject({
				permissions: { read: { allow: [workspaceRule, rule], deny: [] } },
				tools: { read: { permission: 'ask' } },
			});
			expect(getPermissions('chat').read.allow).toEqual(
				profileId === 'chat' ? [workspaceRule, rule] : [workspaceRule]
			);
		}
	);

	it('does not create a separate persistent permissions store', () => {
		expect(mockStoreNames).not.toContain('permissions');
	});

	it('keeps built-in and MCP tools independent for each agent profile', () => {
		setToolProfileTool('voice', { kind: 'builtin', id: 'read' }, { permission: 'deny' });
		setToolProfileTool(
			'chat',
			{ kind: 'mcp', serverId: 'gmail', toolName: 'list_messages' },
			{ permission: 'ask' }
		);

		expect(getToolConfiguration('voice', { kind: 'builtin', id: 'read' })).toEqual({
			permission: 'deny',
		});
		expect(getToolConfiguration('chat', { kind: 'builtin', id: 'read' })).toEqual({
			permission: 'allow',
		});
		expect(getToolProfile('chat').mcp.gmail.list_messages).toEqual({ permission: 'ask' });
	});

	it.each(['ask', 'complete_bootstrap'])('keeps required system tool %s enabled', (toolId) => {
		setAgentProfileTool('chat', { kind: 'builtin', id: toolId }, { permission: 'deny' });

		expect(() =>
			setToolProfileTool('chat', { kind: 'builtin', id: toolId }, { permission: 'ask' })
		).toThrow('Required system tools cannot be disabled.');
		expect(() =>
			setToolProfileTool('chat', { kind: 'builtin', id: toolId }, { permission: 'deny' })
		).toThrow('Required system tools cannot be disabled.');
		expect(getToolConfiguration('chat', { kind: 'builtin', id: toolId })).toEqual({
			permission: 'allow',
		});
		expect(getToolProfile('chat').tools).not.toHaveProperty(toolId);
		expect(getPermissions('chat').tools).not.toHaveProperty(toolId);
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

	it('keeps chatbot speech models available without speech tools', () => {
		setChatbotModel('textToSpeech', {
			providerId: 'openai',
			modelId: 'gpt-4o-mini-tts',
			options: { voice: 'marin' },
		});

		expect(getChatbotModel('textToSpeech')).toMatchObject({ providerId: 'openai' });
		expect(getPermissions().tools).not.toHaveProperty('text_to_speech');
		expect(getPermissions().tools).not.toHaveProperty('speech_to_text');
	});

	it('does not expose removed memory tools through permission settings', () => {
		expect(getPermissions().tools).not.toHaveProperty('save_memory');
		expect(getPermissions().tools).not.toHaveProperty('list_memories');
		expect(getPermissions().tools).not.toHaveProperty('forget_memory');
	});
});
