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
	addPermissionRule,
	getRunBudget,
	setRunBudget,
	getChatbotModel,
	getToolModel,
	getModelId,
	getPermissions,
	getProviderId,
	getToolConfiguration,
	getToolProfile,
	resetPermissions,
	setToolModel,
	setToolProfileTool,
	setChatbotModel,
	setModelId,
	setPermissions,
	setProviderId,
} from '../../../../../src/main/agent/agent_store';
import { getAgentProfileDocument } from '../../../../../src/main/agent/agent_profiles';
import { setAgentProfileTool } from '../../../../../src/main/agent/agent_profiles';
import { resolvePermission } from '../../../../../src/main/agent/permissions/resolve_permission';
import { resolveWorkspace } from '../../../../../src/main/workspaces/resolve';

const AGENT_DIRECTORY = resolveWorkspace('default').files;
const workspaceRule = { root: AGENT_DIRECTORY, recursive: true };
const rule = (root: string, recursive = true) => ({ root, recursive });

beforeEach(() => {
	resetPermissions();
});

describe('agent store permissions', () => {
	it('keeps model fields on media tool configurations', () => {
		expect(getToolModel('image')).toMatchObject({
			providerId: '',
			modelId: '',
			options: {},
		});
	});

	it.each(['chat', 'tasks'] as const)(
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

	it('keeps media models out of the voice profile', () => {
		expect(() =>
			setToolModel('image', { providerId: 'google', modelId: 'voice-image', options: {} }, 'voice')
		).toThrow('Unsupported image model for voice.');
	});

	it('trusts only the workspace by default', () => {
		expect(resetPermissions()).toEqual({
			read: { allow: [workspaceRule], deny: [] },
			write: { allow: [workspaceRule], deny: [] },
			exec: { allow: [workspaceRule], deny: [] },
		});
	});

	it('normalizes rules and keeps the default workspace grant', () => {
		const saved = setPermissions({
			read: { allow: [rule(' /repo '), rule('/repo')], deny: [] },
			write: { allow: [], deny: [rule('/blocked')] },
			exec: { allow: [], deny: [] },
		});
		expect(saved.read.allow).toEqual([workspaceRule, rule('/repo')]);
		expect(saved.write.allow).toEqual([workspaceRule]);
		expect(saved.exec.allow).toEqual([workspaceRule]);
	});

	it('stores one location list for every agent in the chat profile', () => {
		setPermissions({
			read: { allow: [rule('/shared')], deny: [] },
			write: { allow: [], deny: [] },
			exec: { allow: [], deny: [] },
		});

		expect(getAgentProfileDocument('chat')).toMatchObject({
			permissions: { read: { allow: [rule('/shared')], deny: [] } },
		});
		expect(getAgentProfileDocument('voice')).not.toHaveProperty('permissions');
	});

	it('resets locations without resetting tool settings', () => {
		setToolProfileTool('voice', { kind: 'builtin', id: 'read' }, { permission: 'ask' });
		resetPermissions();
		expect(getToolConfiguration('voice', { kind: 'builtin', id: 'read' }).permission).toBe('ask');
		setToolProfileTool('voice', { kind: 'builtin', id: 'read' }, { permission: 'allow' });
	});

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

	it.each(['ask', 'complete_bootstrap', 'update_identity', 'update_soul', 'update_user'])(
		'keeps required system tool %s enabled',
		(toolId) => {
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
		}
	);

	it.each(['update_identity', 'update_soul', 'update_user'])(
		'allows %s without approval despite a saved Ask setting',
		(toolId) => {
			setAgentProfileTool('chat', { kind: 'builtin', id: toolId }, { permission: 'ask' });
			const settings = getToolConfiguration('chat', { kind: 'builtin', id: toolId });
			expect(settings).toEqual({ permission: 'allow' });
			expect(
				resolvePermission({
					permissions: getPermissions(),
					setting: settings.permission,
					interactive: true,
				}).mode
			).toBe('allow');
		}
	);

	it('preserves explicit blocked rules inside the workspace', () => {
		const blocked = rule(`${AGENT_DIRECTORY}/private`);
		const saved = setPermissions({
			read: { allow: [], deny: [blocked] },
			write: { allow: [], deny: [blocked] },
			exec: { allow: [], deny: [blocked] },
		});
		expect(saved.read.deny).toEqual([blocked]);
		expect(saved.write.deny).toEqual([blocked]);
		expect(saved.exec.deny).toEqual([blocked]);
	});

	it('preserves an execute ancestor grant and its explicit blocked child', () => {
		const saved = setPermissions({
			read: { allow: [], deny: [] },
			write: { allow: [], deny: [] },
			exec: { allow: [rule('/shared')], deny: [rule('/shared/private')] },
		});
		expect(saved.exec).toEqual({
			allow: [workspaceRule, rule('/shared')],
			deny: [rule('/shared/private')],
		});
	});

	it('adds a rule without changing other buckets', () => {
		addPermissionRule('exec', 'allow', rule('/repo'));
		expect(getPermissions().exec.allow).toEqual([workspaceRule, rule('/repo')]);
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
		expect(getToolProfile('chat').tools).not.toHaveProperty('text_to_speech');
		expect(getToolProfile('chat').tools).not.toHaveProperty('speech_to_text');
	});

	it('does not expose removed memory tools through permission settings', () => {
		expect(getToolProfile('chat').tools).not.toHaveProperty('save_memory');
		expect(getToolProfile('chat').tools).not.toHaveProperty('list_memories');
		expect(getToolProfile('chat').tools).not.toHaveProperty('forget_memory');
	});
});

it('persists optional chat run limits and rejects invalid settings without replacing them', () => {
	expect(getRunBudget()).toEqual({});
	expect(setRunBudget({ turns: 4, tokens: 12000 })).toEqual({ turns: 4, tokens: 12000 });
	setModelId('another-model');
	expect(getRunBudget()).toEqual({ turns: 4, tokens: 12000 });
	for (const invalid of [{ tokens: -1 }, { turns: 0 }, { turns: 2.5 }, null, { tokens: '4' }])
		expect(() => setRunBudget(invalid)).toThrow();
	expect(getRunBudget()).toEqual({ turns: 4, tokens: 12000 });
	expect(setRunBudget({})).toEqual({});
});
