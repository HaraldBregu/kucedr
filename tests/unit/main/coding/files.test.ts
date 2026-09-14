import { existsSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { CodingProject } from '../../../../src/shared/coding_types';
import { createProjectFile, listProjectFiles } from '../../../../src/main/coding/files';

function project(directory: string): CodingProject {
	return {
		id: 'project-1',
		name: 'project',
		directory,
		kind: 'external',
		createdAt: '2026-09-14T00:00:00.000Z',
		lastOpenedAt: '2026-09-14T00:00:00.000Z',
		available: true,
	};
}

it('creates nested project files and lists their relative paths', async () => {
	const directory = mkdtempSync(path.join(os.tmpdir(), 'kucedr-coding-files-'));
	const created = await createProjectFile(project(directory), 'src/index.ts');

	expect(created).toEqual({ path: 'src/index.ts', type: 'file' });
	expect(existsSync(path.join(directory, 'src', 'index.ts'))).toBe(true);
	expect(await listProjectFiles(project(directory))).toEqual([
		{ path: 'src', type: 'directory' },
		{ path: 'src/index.ts', type: 'file' },
	]);
});

it('keeps created files within the selected project', async () => {
	const directory = mkdtempSync(path.join(os.tmpdir(), 'kucedr-coding-files-'));

	await expect(createProjectFile(project(directory), '../outside.ts')).rejects.toThrow(
		'Coding files must stay inside the project directory.'
	);
});
