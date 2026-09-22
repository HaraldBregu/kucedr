import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { authorizedPaths } from '../../../../../src/main/agent/permissions/access';
import { captureAccess } from '../../../../../src/main/agent/permissions/capture_access';
import { authorizeFilePath } from '../../../../../src/main/agent/files/authorize';
import { writeAuthorizedFile } from '../../../../../src/main/agent/files/write';
import { readTool } from '../../../../../src/main/agent/tools/core/read';
import { toolPermissionTargets } from '../../../../../src/main/agent/permissions/tool_permission_targets';
import { applyPatchTool } from '../../../../../src/main/agent/tools/core/patch';

let directory: string;
beforeEach(() => { directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'agent-file-access-'))); });
afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

it('rejects filesystem execution without a captured grant', async () => {
	await expect(readTool.run({ path: path.join(directory, 'missing') })).rejects.toThrow('approved operation');
});

it('refuses to overwrite a file created while approval was pending', async () => {
	const target = path.join(directory, 'new.txt');
	const grants = captureAccess([target]);
	fs.writeFileSync(target, 'keep');
	await expect(authorizedPaths.run(grants, () => writeAuthorizedFile(target, 'replace'))).rejects.toThrow('changed after authorization');
	expect(fs.readFileSync(target, 'utf8')).toBe('keep');
});

it('rejects a replaced directory that redirects an approved read', async () => {
	const allowed = path.join(directory, 'allowed');
	const outside = path.join(directory, 'outside');
	fs.mkdirSync(allowed);
	fs.mkdirSync(outside);
	fs.writeFileSync(path.join(allowed, 'file'), 'allowed');
	fs.writeFileSync(path.join(outside, 'file'), 'private');
	const target = path.join(allowed, 'file');
	const grants = captureAccess([target]);
	fs.renameSync(allowed, `${allowed}-before`);
	fs.symlinkSync(outside, allowed, 'dir');
	await expect(authorizedPaths.run(grants, () => readTool.run({ path: target }))).rejects.toThrow('approved operation');
});

it('creates an approved missing file exclusively and reads its contents', async () => {
	const target = path.join(directory, 'new.txt');
	await authorizedPaths.run(captureAccess([target]), () => writeAuthorizedFile(target, 'new'));
	await expect(authorizedPaths.run(captureAccess([target]), () => readTool.run({ path: target }))).resolves.toBe('new');
});

it('includes every executable patch header in permission targets', () => {
	const first = path.join(directory, 'first');
	const second = path.join(directory, 'second');
	const input = `*** Begin Patch\n*** Add File: ${first}\n+one\n\u00a0*** Add File: ${second}\n+two\n*** End Patch`;
	expect(toolPermissionTargets('patch', { input }, directory)).toEqual([first, second]);
});

it('requires hard approval when an Add File patch would overwrite an existing file', () => {
	const target = path.join(directory, 'existing');
	fs.writeFileSync(target, 'keep');
	const input = `*** Begin Patch\n*** Add File: ${target}\n+replace\n*** End Patch`;
	expect(typeof applyPatchTool.hardApproval === 'function' && applyPatchTool.hardApproval({ input })).toBe(true);
});

it('rejects a changed file identity before an edit can execute', () => {
	const target = path.join(directory, 'existing');
	fs.writeFileSync(target, 'before');
	const grants = captureAccess([target]);
	fs.renameSync(target, `${target}-before`);
	fs.writeFileSync(target, 'after');
	expect(() => authorizedPaths.run(grants, () => authorizeFilePath(target))).toThrow('changed after authorization');
});

it('rejects in-place edits made while file approval is pending', async () => {
	const target = path.join(directory, 'existing');
	fs.writeFileSync(target, 'before');
	const grants = captureAccess([target]);
	fs.writeFileSync(target, 'changed content');
	await expect(authorizedPaths.run(grants, () => writeAuthorizedFile(target, 'replace'))).rejects.toThrow('changed after authorization');
	expect(fs.readFileSync(target, 'utf8')).toBe('changed content');
});
