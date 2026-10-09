import path from 'node:path';
import { directoryPermissionTargets } from '../../../../../src/main/agent/permissions/directory_permission_targets';
import { taskStorePath } from '../../../../../src/main/tasks/tasks_store';
import { registry, type ProcessSession } from '../../../../../src/main/agent/tools/core/process';
import { libraryLocation } from '../../../../../src/main/shared/library_location';
import { realPath } from '../../../../../src/main/shared/real_path';

const agentDir = path.resolve('/appdata/agent');

describe('directoryPermissionTargets', () => {
	it('uses an exec working directory instead of its command', () => {
		expect(
			directoryPermissionTargets(
				'bash',
				{ command: 'npm test', workdir: '/workspace/app' },
				agentDir
			)
		).toEqual([path.resolve('/workspace/app')]);
	});

	it('includes canonical additional exec roots resolved from workdir', () => {
		expect(
			directoryPermissionTargets(
				'bash',
				{ command: 'npm test', workdir: '/workspace/app', additionalRoots: ['../shared'] },
				agentDir
			)
		).toEqual([path.resolve('/workspace/app'), path.resolve('/workspace/shared')]);
	});

	it('uses the agent directory for exec without an explicit working directory', () => {
		expect(directoryPermissionTargets('bash', { command: 'npm test' }, agentDir)).toEqual([
			agentDir,
		]);
	});

	it('does not create an exec target without a command', () => {
		expect(directoryPermissionTargets('bash', { workdir: '/workspace/app' }, agentDir)).toEqual([]);
	});

	it('reuses file targets for filesystem tools', () => {
		expect(directoryPermissionTargets('write', { path: '/workspace/a.txt' }, agentDir)).toEqual([
			path.resolve('/workspace/a.txt'),
		]);
	});

	it('uses the containing folder for read', () => {
		expect(directoryPermissionTargets('read', { path: '/workspace/a.txt' }, agentDir)).toEqual([
			path.resolve('/workspace'),
		]);
	});

	it('maps bootstrap completion to its agent-owned resource', () => {
		expect(directoryPermissionTargets('complete_bootstrap', {}, agentDir)).toEqual([
			path.join(agentDir, 'BOOTSTRAP.md'),
		]);
	});

	it('maps schedule changes to the shared cron store', () => {
		expect(directoryPermissionTargets('create_task', {}, agentDir)).toEqual([realPath(taskStorePath)]);
	});

	it('maps generated media and keeps skill activation path-independent', () => {
		expect(directoryPermissionTargets('create_image', {}, agentDir)).toEqual([realPath(libraryLocation())]);
		expect(directoryPermissionTargets('create_sound', { directory: 'clips' }, agentDir)).toEqual([
			path.join(agentDir, 'clips'),
		]);
		expect(
			directoryPermissionTargets('camera_recorder', { directory: 'captures' }, agentDir)
		).toEqual([path.join(agentDir, 'captures')]);
		expect(directoryPermissionTargets('load_skill', { name: 'example' }, agentDir)).toEqual([]);
	});

	it.each(['create_image', 'create_video', 'create_sound', 'camera_recorder', 'microphone_recorder', 'screen_recorder'])(
		'checks the default Library destination for %s',
		(toolName) => {
			expect(directoryPermissionTargets(toolName, {}, agentDir)).toEqual([realPath(libraryLocation())]);
		}
	);

	it.each(['screenshot', 'pdf'])('checks browser %s output destinations', (action) => {
		expect(directoryPermissionTargets('use_web_browser', { action }, agentDir)).toEqual([realPath(libraryLocation())]);
		expect(directoryPermissionTargets('use_web_browser', { action, directory: 'captures' }, agentDir)).toEqual([path.join(agentDir, 'captures')]);
		expect(directoryPermissionTargets('use_web_browser', { action, directory: '' }, agentDir)).toEqual([agentDir]);
	});

	it('does not assign a write target to other browser actions', () => {
		expect(directoryPermissionTargets('use_web_browser', { action: 'snapshot' }, agentDir)).toEqual([]);
	});

	it('uses the originating exec workdir for process calls', () => {
		const session = {
			id: 'permission-session',
			workdir: '/workspace/app',
			roots: ['/shared'],
			executionMode: 'sandbox',
		} as ProcessSession;
		registry.register(session);
		try {
			expect(
				directoryPermissionTargets('process', { action: 'poll', sessionId: session.id }, agentDir)
			).toEqual([path.resolve('/workspace/app'), path.resolve('/shared')]);
		} finally {
			registry.remove(session.id);
		}
	});
});
