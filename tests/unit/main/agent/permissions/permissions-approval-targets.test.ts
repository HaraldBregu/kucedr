import path from 'node:path';
import { toolApprovalTargets } from '../../../../../src/main/agent/permissions/tool_approval_targets';

const agentDir = path.resolve('/appdata/agent');

describe('toolApprovalTargets', () => {
	it('stores the containing folder for read', () => {
		expect(toolApprovalTargets('read', { path: '/workspace/a.txt' }, agentDir)).toEqual([
			path.resolve('/workspace'),
		]);
	});

	it.each(['screenshot', 'pdf'])('stores the selected browser %s output folder', (action) => {
		expect(
			toolApprovalTargets('use_web_browser', { action, directory: '/workspace/captures' }, agentDir)
		).toEqual([path.resolve('/workspace/captures')]);
	});

	it('stores the containing folder for write and the declared exec roots', () => {
		expect(toolApprovalTargets('write', { path: '/workspace/a.txt' }, agentDir)).toEqual([
			path.resolve('/workspace'),
		]);
		expect(
			toolApprovalTargets(
				'bash',
				{ command: 'npm test', workdir: '/workspace', additionalRoots: ['/shared'] },
				agentDir
			)
		).toEqual([path.resolve('/workspace'), path.resolve('/shared')]);
	});

	it('stores the selected output folder for generated media', () => {
		expect(
			toolApprovalTargets('create_image', { directory: '/workspace/images' }, agentDir)
		).toEqual([path.resolve('/workspace/images')]);
	});
});
