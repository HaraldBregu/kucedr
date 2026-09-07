import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

jest.mock('../../../../../src/main/shared/user_data_location', () => {
	const directory = jest.requireActual<typeof fs>('node:fs').mkdtempSync(jest.requireActual<typeof path>('node:path').join(jest.requireActual<typeof os>('node:os').tmpdir(), 'kucedr-destructive-'));
	return { userDataLocation: () => directory };
});

import { applyPatchTool } from '../../../../../src/main/agent/tools/core/patch';
import { writeTool } from '../../../../../src/main/agent/tools/core/write';
import { runToolCall } from '../../../../../src/main/agent/runner/run_tool_call';
import { userDataLocation } from '../../../../../src/main/shared/user_data_location';
import { resetPermissions } from '../../../../../src/main/agent/agent_store';
import { realPath } from '../../../../../src/main/shared/real_path';

afterAll(() => fs.rmSync(userDataLocation(), { recursive: true, force: true }));

it.each(['overwrite', 'delete', 'move'])('requests a reusable location grant before outside %s', async (operation) => {
	resetPermissions();
	const target = path.join(userDataLocation(), `${operation}.txt`);
	const moved = path.join(userDataLocation(), `${operation}-moved.txt`);
	fs.writeFileSync(target, 'content');
	const tool = operation === 'overwrite' ? writeTool : applyPatchTool;
	const args = operation === 'overwrite' ? { path: target, content: 'replacement' }
		: { input: operation === 'delete'
			? `*** Begin Patch\n*** Delete File: ${target}\n*** End Patch`
			: `*** Begin Patch\n*** Update File: ${target}\n*** Move to: ${moved}\n@@\n-content\n+updated\n*** End Patch` };
	const events = runToolCall(tool, { id: operation, name: tool.id, args }, undefined, undefined, { runId: 'run', windowId: 1 });
	await events.next();
	try {
		expect((await events.next()).value).toMatchObject({
			type: 'tool_permission_request', persistable: true,
			targets: [realPath(userDataLocation())], reason: 'outside_trusted_location',
		});
		expect(fs.readFileSync(target, 'utf8')).toBe('content');
		expect(fs.existsSync(moved)).toBe(false);
	} finally {
		await events.return();
	}
});
