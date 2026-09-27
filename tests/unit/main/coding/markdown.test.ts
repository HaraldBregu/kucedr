import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { CodingProject } from '../../../../src/shared/coding_types';
import { markdownLocation } from '../../../../src/main/coding/context_location';
import { createMarkdownFile } from '../../../../src/main/coding/create';
import { readMarkdownFile } from '../../../../src/main/coding/load';
import { listMarkdownFiles } from '../../../../src/main/coding/markdown';
import { saveMarkdownFile } from '../../../../src/main/coding/save';

it('stores only Coder-created Markdown under separate project workspaces', async () => {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'kucedr-markdown-'));
	const previousRoot = process.env.KUCEDR_E2E_DATA_ROOT;
	process.env.KUCEDR_E2E_DATA_ROOT = path.join(directory, 'data');
	const root = path.join(directory, 'project');
	const project: CodingProject = {
		id: 'project',
		name: 'project',
		directory: root,
		kind: 'external',
		createdAt: '',
		lastOpenedAt: '',
		available: true,
	};
	try {
		await mkdir(root);
		await writeFile(path.join(root, 'AGENTS.md'), '# Agent');
		await writeFile(path.join(directory, 'outside.md'), 'outside');
		expect(await listMarkdownFiles(project)).toEqual([]);
		await createMarkdownFile(project, 'plan.md');
		expect(markdownLocation(project)).toContain(path.join('coder', 'workspaces'));
		expect(await listMarkdownFiles(project)).toEqual(['plan.md']);
		await saveMarkdownFile(project, 'plan.md', '# Updated', '');
		expect(await readMarkdownFile(project, 'plan.md')).toBe('# Updated');
		expect(await readFile(path.join(root, 'AGENTS.md'), 'utf8')).toBe('# Agent');
		const other = { ...project, directory: path.join(directory, 'other') };
		expect(await listMarkdownFiles(other)).toEqual([]);
		await expect(saveMarkdownFile(project, 'plan.md', 'stale', '')).rejects.toThrow(
			'changed outside'
		);
		await expect(createMarkdownFile(project, '../outside.md')).rejects.toThrow(
			'Invalid coding Markdown'
		);
		await expect(saveMarkdownFile(project, '../outside.md', 'bad', 'outside')).rejects.toThrow(
			'Invalid coding Markdown'
		);
		await symlink(path.join(directory, 'outside.md'), path.join(markdownLocation(project), 'linked.md'));
		await expect(saveMarkdownFile(project, 'linked.md', 'bad', 'outside')).rejects.toThrow(
			'regular'
		);
	} finally {
		if (previousRoot === undefined) delete process.env.KUCEDR_E2E_DATA_ROOT;
		else process.env.KUCEDR_E2E_DATA_ROOT = previousRoot;
		await rm(directory, { recursive: true, force: true });
	}
});
