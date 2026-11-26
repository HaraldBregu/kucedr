import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { migrateWorkspaceMemory } from '../../../../../src/main/memory/migrate';
import { memoryPath } from '../../../../../src/main/memory/path';
import { prepareMemorySettings } from '../../../../../src/main/memory/settings';
import { WORKSPACE_FILES } from '../../../../../src/main/agent/system/system_types';
import { resolveWorkspace } from '../../../../../src/main/workspaces/resolve';
import type { Workspace } from '../../../../../src/main/workspaces/types';

describe('memory storage', () => {
	let root: string;
	let workspace: Workspace;
	let previousDataRoot: string | undefined;

	beforeEach(async () => {
		root = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-memory-storage-'));
		previousDataRoot = process.env.KUCEDR_E2E_DATA_ROOT;
		process.env.KUCEDR_E2E_DATA_ROOT = root;
		workspace = resolveWorkspace('default');
		await fs.mkdir(workspace.files, { recursive: true });
	});

	afterEach(async () => {
		if (previousDataRoot === undefined) delete process.env.KUCEDR_E2E_DATA_ROOT;
		else process.env.KUCEDR_E2E_DATA_ROOT = previousDataRoot;
		await fs.rm(root, { recursive: true, force: true });
	});

	it('moves legacy settings and workspace memory into the standalone folder', async () => {
		const legacySettings = path.join(root, 'settings', 'memory.json');
		const legacyMemory = path.join(workspace.files, 'MEMORY.md');
		await fs.mkdir(path.dirname(legacySettings), { recursive: true });
		await fs.writeFile(legacySettings, '{"initialized":true}\n');
		await fs.writeFile(legacyMemory, '# Memory\n\n- Prefers concise answers\n');

		expect(prepareMemorySettings()).toBe(path.join(root, 'memory'));
		await migrateWorkspaceMemory(workspace);
		await migrateWorkspaceMemory(workspace);

		expect(await fs.readFile(path.join(root, 'memory', 'settings.json'), 'utf8')).toContain(
			'"initialized":true'
		);
		expect(await fs.readFile(memoryPath(workspace), 'utf8')).toContain('Prefers concise answers');
		await expect(fs.stat(legacySettings)).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(fs.stat(legacyMemory)).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('merges distinct workspace notes without replacing standalone memory', async () => {
		const legacyMemory = path.join(workspace.files, 'MEMORY.md');
		await fs.mkdir(path.dirname(memoryPath(workspace)), { recursive: true });
		await fs.writeFile(memoryPath(workspace), '# Memory\n\n- Uses TypeScript\n');
		await fs.writeFile(legacyMemory, '# Manual notes\n\n- Prefers concise answers\n');

		await migrateWorkspaceMemory(workspace);

		const migrated = await fs.readFile(memoryPath(workspace), 'utf8');
		expect(migrated).toContain('Uses TypeScript');
		expect(migrated).toContain('Prefers concise answers');
		await expect(fs.stat(legacyMemory)).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('keeps conflicting legacy settings as a backup inside the memory folder', async () => {
		const legacySettings = path.join(root, 'settings', 'memory.json');
		const settings = path.join(root, 'memory', 'settings.json');
		await fs.mkdir(path.dirname(legacySettings), { recursive: true });
		await fs.mkdir(path.dirname(settings), { recursive: true });
		await fs.writeFile(legacySettings, '{"source":"legacy"}\n');
		await fs.writeFile(settings, '{"source":"current"}\n');

		prepareMemorySettings();

		const files = await fs.readdir(path.join(root, 'memory'));
		expect(files).toContain('settings.json');
		expect(files.some((file) => /^settings\.legacy-\d+-[a-f0-9-]+\.json$/.test(file))).toBe(true);
		expect(await fs.readFile(settings, 'utf8')).toContain('current');
		await expect(fs.stat(legacySettings)).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('does not scaffold MEMORY.md as a workspace file', () => {
		expect(WORKSPACE_FILES).not.toContain('MEMORY.md');
	});
});
