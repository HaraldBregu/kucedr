import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const showItemInFolder = jest.fn();
jest.mock('electron', () => ({ shell: { showItemInFolder } }));

import { revealWorkspaceEntry } from '../../../../src/main/ipc/reveal';

let root: string;

beforeEach(() => {
	root = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-workspace-reveal-'));
	showItemInFolder.mockClear();
});

afterEach(() => {
	fs.rmSync(root, { recursive: true, force: true });
});

it('reveals the selected file and folder', async () => {
	fs.mkdirSync(path.join(root, 'Notes'));
	fs.writeFileSync(path.join(root, 'Notes', 'plan.md'), '# Plan');
	await revealWorkspaceEntry(root, 'Notes/plan.md');
	await revealWorkspaceEntry(root, 'Notes');
	expect(showItemInFolder).toHaveBeenNthCalledWith(1, path.join(root, 'Notes', 'plan.md'));
	expect(showItemInFolder).toHaveBeenNthCalledWith(2, path.join(root, 'Notes'));
});

it('rejects paths outside the Workspace before opening Finder', async () => {
	await expect(revealWorkspaceEntry(root, '../outside.txt')).rejects.toThrow('outside workspace');
	expect(showItemInFolder).not.toHaveBeenCalled();
});
