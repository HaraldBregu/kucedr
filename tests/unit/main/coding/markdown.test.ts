import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { CodingProject } from '../../../../src/shared/coding_types';
import { listMarkdownFiles } from '../../../../src/main/coding/markdown';
import { saveMarkdownFile } from '../../../../src/main/coding/save';

it('lists project Markdown without coding files and saves edits safely', async () => {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'kucedr-markdown-'));
	const root = path.join(directory, 'project');
	const project: CodingProject = {
		id: 'project', name: 'project', directory: root, kind: 'external',
		createdAt: '', lastOpenedAt: '', available: true,
	};
	try {
		await mkdir(path.join(root, 'docs'), { recursive: true });
		await mkdir(path.join(root, 'node_modules'));
		await writeFile(path.join(root, 'AGENTS.md'), '# Agent');
		await writeFile(path.join(root, 'docs', 'plan.md'), '# Plan');
		await writeFile(path.join(root, 'main.ts'), 'code');
		await writeFile(path.join(root, 'node_modules', 'README.md'), 'dependency');
		await writeFile(path.join(directory, 'outside.md'), 'outside');
		await symlink(path.join(directory, 'outside.md'), path.join(root, 'linked.md'));
		expect(await listMarkdownFiles(project)).toEqual(['AGENTS.md', 'docs/plan.md']);
		await saveMarkdownFile(project, 'docs/plan.md', '# Updated', '# Plan');
		expect(await readFile(path.join(root, 'docs', 'plan.md'), 'utf8')).toBe('# Updated');
		await expect(saveMarkdownFile(project, 'docs/plan.md', 'stale', '# Plan')).rejects.toThrow('changed outside');
		await expect(saveMarkdownFile(project, 'main.ts', 'bad', 'code')).rejects.toThrow('Only Markdown');
		await expect(saveMarkdownFile(project, '../outside.md', 'bad', 'outside')).rejects.toThrow('inside');
		await expect(saveMarkdownFile(project, 'linked.md', 'bad', 'outside')).rejects.toThrow('regular');
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
