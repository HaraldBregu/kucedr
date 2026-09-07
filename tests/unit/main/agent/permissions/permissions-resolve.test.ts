const getPermissions = jest.fn();

jest.mock('../../../../../src/main/agent/agent_store', () => ({
	AGENT_DIRECTORY: '/appdata/agent',
	getPermissions,
}));

import { createRunContext } from '../../../../../src/main/agent/context';
import { resolveToolPermission } from '../../../../../src/main/agent/permissions/resolve_tool_permission';
import type { PermissionsSchema } from '../../../../../src/main/agent/permissions/permissions_types';

const defaults: PermissionsSchema = {
	read: { allow: ['/outside/**'], deny: [] },
	write: { allow: [], deny: [] },
	exec: { allow: ['/appdata/agent/**'], deny: [] },
};

beforeEach(() => {
	getPermissions.mockReset().mockReturnValue(defaults);
});

describe('resolveToolPermission', () => {
	it('uses an injected policy without consulting the global policy', () => {
		const injected: PermissionsSchema = {
			...defaults,
			read: { allow: [], deny: ['/outside/**'] },
		};

		expect(
			resolveToolPermission('read', { path: '/outside/a.txt' }, undefined, true, 'ask', injected)
		).toBe('deny');
		expect(getPermissions).not.toHaveBeenCalled();
	});

	it('uses configured rules and the caller fallback for unknown tools', () => {
		expect(resolveToolPermission('read', { path: '/outside/a.txt' })).toBe('allow');
		expect(resolveToolPermission('read', { path: '/untrusted/a.txt' })).toBe('allow');
		expect(resolveToolPermission('edit', { path: '/outside/a.txt' })).toBe('ask');
		expect(resolveToolPermission('mcp__safe__lookup', {}, undefined, true, 'allow')).toBe('allow');
		expect(resolveToolPermission('mcp__records__delete')).toBe('allow');
	});

	it('keeps deny precedence over allow and contextual reuse', () => {
		getPermissions.mockReturnValue({
			...defaults,
			read: { allow: ['/repo/**'], deny: ['/repo/private/**'] },
		});
		const fileAccess = createRunContext().fileAccess;
		fileAccess.readDirectories.add('/repo/private');

		expect(resolveToolPermission('read', { path: '/repo/public/a.txt' })).toBe('allow');
		expect(resolveToolPermission('read', { path: '/repo/private/a.txt' }, fileAccess)).toBe('deny');
	});

	it('allows shell reads anywhere and asks for outside write access', () => {
		getPermissions.mockReturnValue({
			...defaults,
			exec: { allow: ['/appdata/agent/**'], deny: ['/appdata/agent/private/**'] },
		});

		expect(resolveToolPermission('bash', { command: 'echo ok > result.txt' })).toBe('allow');
		expect(resolveToolPermission('bash', { command: 'echo $(pwd)' })).toBe('allow');
		expect(resolveToolPermission('bash', { command: 'pwd', workdir: '/outside' })).toBe('allow');
		expect(resolveToolPermission('bash', { command: 'pwd', workdir: 'private' })).toBe('deny');
		expect(resolveToolPermission('bash', { command: 'pwd', elevated: true })).toBe('ask');
		expect(resolveToolPermission('bash', { command: 'touch file', workdir: '/outside', additionalRoots: ['.'] })).toBe('ask');
	});

	it('asks when any declared external root is not trusted', () => {
		expect(
			resolveToolPermission('bash', {
				command: 'cp file /shared',
				additionalRoots: ['/shared'],
			})
		).toBe('ask');
		getPermissions.mockReturnValue({
			...defaults,
			exec: { allow: ['/appdata/agent/**', '/shared/**'], deny: [] },
		});
		expect(
			resolveToolPermission('bash', {
				command: 'cp file /shared',
				additionalRoots: ['/shared'],
			})
		).toBe('allow');
	});

	it.each([
		['save_memory', {}],
		['forget_memory', {}],
		['update_health', {}],
		['update_health_settings', {}],
		['complete_bootstrap', {}],
		['create_task', {}],
		['update_task', {}],
		['pause_task', {}],
		['resume_task', {}],
		['delete_task', {}],
		['run_task_now', {}],
		['ingest_wiki_source', {}],
		['save_wiki_analysis', {}],
		['review_wiki_changes', {}],
		['rebuild_wiki_index', {}],
		['lint_wiki', { autoFix: true }],
		['microphone_recorder', {}],
		['camera_recorder', {}],
		['screen_recorder', {}],
	] as const)('applies the write policy to %s', (toolName, args) => {
		const denyWrites: PermissionsSchema = {
			...defaults,
			write: { allow: [], deny: ['*'] },
		};

		expect(resolveToolPermission(toolName, args, undefined, true, 'ask', denyWrites)).toBe('deny');
	});

	it('distinguishes read-only operations from conditional writes', () => {
		const denyWrites: PermissionsSchema = {
			...defaults,
			write: { allow: [], deny: ['*'] },
		};

		expect(resolveToolPermission('get_task', {}, undefined, true, 'ask', denyWrites)).toBe('allow');
		expect(resolveToolPermission('list_tasks', {}, undefined, true, 'ask', denyWrites)).toBe(
			'allow'
		);
		expect(
			resolveToolPermission('lint_wiki', { autoFix: false }, undefined, true, 'ask', denyWrites)
		).toBe('allow');
	});

	it('allows recorder output in trusted roots and asks outside them', () => {
		const trustedWrites: PermissionsSchema = {
			...defaults,
			write: { allow: ['/appdata/agent/**'], deny: [] },
		};

		expect(
			resolveToolPermission('screen_recorder', {}, undefined, true, 'ask', trustedWrites)
		).toBe('allow');
		expect(
			resolveToolPermission(
				'screen_recorder',
				{ directory: '/outside' },
				undefined,
				true,
				'ask',
				trustedWrites
			)
		).toBe('ask');
	});
});
