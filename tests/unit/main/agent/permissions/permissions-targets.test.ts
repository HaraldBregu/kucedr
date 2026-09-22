import path from 'node:path';
import { toolPermissionTargets } from '../../../../../src/main/agent/permissions/tool_permission_targets';
import { resolveUserPath } from '../../../../../src/main/shared/user_path';

const agentDir = path.resolve('/appdata/agent');

describe('toolPermissionTargets', () => {
	it('extracts full targets from patch headers and moves', () => {
		const input = [
			'*** Begin Patch',
			'*** Add File: src/a.ts',
			'+added',
			'*** Update File: lib/b.ts',
			'*** Move to: moved/b.ts',
			'@@',
			'-before',
			'+after',
			'*** End Patch',
		].join('\n');
		expect(toolPermissionTargets('patch', { input }, agentDir)).toEqual([
			resolveUserPath('src/a.ts', agentDir),
			resolveUserPath('lib/b.ts', agentDir),
			resolveUserPath('moved/b.ts', agentDir),
		]);
	});

	it('extracts whitespace-prefixed patch headers', () => {
		const input = '*** Begin Patch\n  *** Update File: outside/a.ts\n\t*** Move to: outside/b.ts\n@@\n-old\n+new\n*** End Patch';
		expect(toolPermissionTargets('patch', { input }, agentDir)).toEqual([
			resolveUserPath('outside/a.ts', agentDir),
			resolveUserPath('outside/b.ts', agentDir),
		]);
	});

	it('returns the raw exec command', () => {
		expect(toolPermissionTargets('bash', { command: 'git status' }, agentDir)).toEqual([
			'git status',
		]);
		expect(toolPermissionTargets('bash', {}, agentDir)).toEqual([]);
	});

	it('returns the full file path for path tools', () => {
		expect(toolPermissionTargets('write', { path: '/a/b.txt' }, agentDir)).toEqual([
			resolveUserPath('/a/b.txt', agentDir),
		]);
		expect(toolPermissionTargets('write', {}, agentDir)).toEqual([]);
	});

	it('returns the exact file for read permission evaluation', () => {
		expect(toolPermissionTargets('read', { path: '/a/b.txt' }, agentDir)).toEqual([
			resolveUserPath('/a/b.txt', agentDir),
		]);
	});
});
