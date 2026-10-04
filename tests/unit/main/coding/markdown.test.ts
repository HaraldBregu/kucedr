import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { CodingProject } from '../../../../src/shared/coding_types';
import { markdownLocation } from '../../../../src/main/coding/context_location';
import { deleteMarkdownFile } from '../../../../src/main/coding/delete';
import { createMarkdownFile } from '../../../../src/main/coding/create';
import { readMarkdownFile } from '../../../../src/main/coding/load';
import { listMarkdownFiles } from '../../../../src/main/coding/markdown';
import { CodingInstructions } from '../../../../src/main/coding/instructions';
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
		await symlink(
			path.join(directory, 'outside.md'),
			path.join(markdownLocation(project), 'linked.md')
		);
		await expect(readMarkdownFile(project, 'linked.md')).rejects.toThrow();
		await expect(saveMarkdownFile(project, 'linked.md', 'bad', 'outside')).rejects.toThrow(
			'regular'
		);
	} finally {
		if (previousRoot === undefined) delete process.env.KUCEDR_E2E_DATA_ROOT;
		else process.env.KUCEDR_E2E_DATA_ROOT = previousRoot;
		await rm(directory, { recursive: true, force: true });
	}
});


it('stores managed workspace Markdown beside its files and exposes shared instructions to each harness', async () => {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'kucedr-managed-markdown-'));
	const previousRoot = process.env.KUCEDR_E2E_DATA_ROOT;
	process.env.KUCEDR_E2E_DATA_ROOT = directory;
	const root = path.join(directory, 'coder', 'workspaces', 'managed', 'files');
	const project: CodingProject = {
		id: 'managed', name: 'Workspace 1', directory: root, kind: 'agent-workspace',
		createdAt: '', lastOpenedAt: '', available: true,
	};
	try {
		await mkdir(root, { recursive: true });
		expect(markdownLocation(project)).toBe(root);
		await createMarkdownFile(project, 'AGENTS.md');
		await saveMarkdownFile(project, 'AGENTS.md', '# Workspace instructions', '');
		await createMarkdownFile(project, 'notes.md');
		expect(await listMarkdownFiles(project)).toEqual(['AGENTS.md', 'notes.md']);
		expect(await readFile(path.join(root, 'AGENTS.md'), 'utf8')).toBe('# Workspace instructions');
		await expect(createMarkdownFile(project, 'AGENTS.md')).rejects.toMatchObject({ code: 'EEXIST' });
		expect(await readMarkdownFile(project, 'AGENTS.md')).toBe('# Workspace instructions');
		const instructions = new CodingInstructions(path.join(directory, 'coder', 'pi'));
		for (const harness of ['pi', 'codex', 'cline'] as const) {
			expect(await instructions.get(project, harness)).toMatchObject({
				activeFilePath: path.join(root, 'AGENTS.md'),
				content: '# Workspace instructions', exists: true,
			});
		}
		await saveMarkdownFile(project, 'AGENTS.md', '# Updated instructions', '# Workspace instructions');
		await expect(saveMarkdownFile(project, 'AGENTS.md', 'stale', '# Workspace instructions')).rejects.toThrow('changed outside');
	} finally {
		if (previousRoot === undefined) delete process.env.KUCEDR_E2E_DATA_ROOT;
		else process.env.KUCEDR_E2E_DATA_ROOT = previousRoot;
		await rm(directory, { recursive: true, force: true });
	}
});

it('deletes only the selected workspace regular Markdown file', async () => {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'kucedr-delete-markdown-'));
	const project: CodingProject = {
		id: 'managed', name: 'Workspace', directory: path.join(directory, 'workspace'),
		kind: 'agent-workspace', createdAt: '', lastOpenedAt: '', available: true,
	};
	const other = { ...project, id: 'other', directory: path.join(directory, 'other') };
	try {
		await createMarkdownFile(project, 'notes.md');
		await createMarkdownFile(other, 'notes.md');
		await deleteMarkdownFile(project, 'notes.md');
		expect(await listMarkdownFiles(project)).toEqual([]);
		expect(await listMarkdownFiles(other)).toEqual(['notes.md']);
		await expect(readFile(path.join(project.directory, 'notes.md'))).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(deleteMarkdownFile(project, 'notes.md')).rejects.toMatchObject({ code: 'ENOENT' });
		await writeFile(path.join(directory, 'outside.md'), 'outside');
		await writeFile(path.join(project.directory, 'notes.txt'), 'text');
		await mkdir(path.join(project.directory, 'folder.md'));
		await symlink(path.join(directory, 'outside.md'), path.join(project.directory, 'linked.md'));
		for (const fileName of ['../outside.md', 'notes.txt', path.join(directory, 'outside.md')]) {
			await expect(deleteMarkdownFile(project, fileName)).rejects.toThrow('Invalid coding Markdown');
		}
		for (const fileName of ['folder.md', 'linked.md']) {
			await expect(deleteMarkdownFile(project, fileName)).rejects.toThrow('regular Markdown');
		}
		expect(await readFile(path.join(directory, 'outside.md'), 'utf8')).toBe('outside');
		expect(await readFile(path.join(project.directory, 'notes.txt'), 'utf8')).toBe('text');
		expect(await readFile(path.join(project.directory, 'linked.md'), 'utf8')).toBe('outside');
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
