import {
	existsSync,
	lstatSync,
	mkdtempSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { CodingProject } from '../../../../src/shared/coding_types';
import { CodingInstructions } from '../../../../src/main/coder/instructions';

const timestamp = '2026-08-22T08:00:00.000Z';

it('uses Pi filename precedence, reports inherited sources, and isolates workspace saves', async () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-coding-instructions-'));
	const agentDirectory = path.join(root, 'coding-global');
	const projectsDirectory = path.join(root, 'projects');
	const firstDirectory = path.join(projectsDirectory, 'first');
	const secondDirectory = path.join(projectsDirectory, 'second');
	mkdirSync(agentDirectory);
	mkdirSync(firstDirectory, { recursive: true });
	mkdirSync(secondDirectory);
	writeFileSync(path.join(agentDirectory, 'AGENTS.md'), 'global');
	writeFileSync(path.join(projectsDirectory, 'CLAUDE.md'), 'ancestor');
	writeFileSync(path.join(firstDirectory, 'CLAUDE.md'), 'claude');
	writeFileSync(path.join(firstDirectory, 'AGENTS.md'), 'agents');
	writeFileSync(path.join(firstDirectory, 'AGENTS.override.md'), 'override');
	writeFileSync(path.join(secondDirectory, 'AGENTS.md'), 'second');
	const first: CodingProject = {
		id: 'first',
		name: 'first',
		directory: firstDirectory,
		kind: 'external',
		createdAt: timestamp,
		lastOpenedAt: timestamp,
		available: true,
	};
	const second: CodingProject = {
		...first,
		id: 'second',
		name: 'second',
		directory: secondDirectory,
	};
	const instructions = new CodingInstructions(agentDirectory);

	const firstResult = await instructions.get(first);
	const secondResult = await instructions.get(second);

	expect(firstResult).toMatchObject({
		projectId: first.id,
		activeFileName: 'AGENTS.override.md',
		content: 'override',
		exists: true,
		editable: true,
	});
	expect(firstResult.loadedSources).toEqual(
		expect.arrayContaining([
			{ path: path.join(agentDirectory, 'AGENTS.md'), scope: 'coding-global' },
			{ path: path.join(projectsDirectory, 'CLAUDE.md'), scope: 'ancestor' },
			{ path: path.join(firstDirectory, 'AGENTS.override.md'), scope: 'workspace' },
		])
	);
	expect(secondResult).toMatchObject({ activeFileName: 'AGENTS.md', content: 'second' });

	const saved = await instructions.save(first, {
		content: 'updated override',
		expectedRevision: firstResult.revision,
	});

	expect(saved.content).toBe('updated override');
	expect(readFileSync(path.join(firstDirectory, 'AGENTS.override.md'), 'utf8')).toBe(
		'updated override'
	);
	expect(readFileSync(path.join(secondDirectory, 'AGENTS.md'), 'utf8')).toBe('second');
	expect(readdirSync(firstDirectory).some((name) => name.endsWith('.tmp'))).toBe(false);
});

it('creates AGENTS.md and preserves an explicitly saved empty file', async () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-coding-instructions-'));
	const agentDirectory = path.join(root, 'coding-global');
	const projectDirectory = path.join(root, 'project');
	mkdirSync(agentDirectory);
	mkdirSync(projectDirectory);
	const project: CodingProject = {
		id: 'project',
		name: 'project',
		directory: projectDirectory,
		kind: 'external',
		createdAt: timestamp,
		lastOpenedAt: timestamp,
		available: true,
	};
	const instructions = new CodingInstructions(agentDirectory);
	const initial = await instructions.get(project);

	expect(initial).toMatchObject({
		activeFilePath: path.join(projectDirectory, 'AGENTS.md'),
		content: '',
		exists: false,
		editable: true,
	});

	const saved = await instructions.save(project, {
		content: '',
		expectedRevision: initial.revision,
	});

	expect(saved).toMatchObject({ content: '', exists: true, editable: true });
	expect(existsSync(path.join(projectDirectory, 'AGENTS.md'))).toBe(true);
	expect(lstatSync(path.join(projectDirectory, 'AGENTS.md')).isFile()).toBe(true);
});

it('rejects stale revisions without overwriting external edits', async () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-coding-instructions-'));
	const agentDirectory = path.join(root, 'coding-global');
	const projectDirectory = path.join(root, 'project');
	mkdirSync(agentDirectory);
	mkdirSync(projectDirectory);
	const filePath = path.join(projectDirectory, 'AGENTS.md');
	writeFileSync(filePath, 'initial');
	const project: CodingProject = {
		id: 'project',
		name: 'project',
		directory: projectDirectory,
		kind: 'external',
		createdAt: timestamp,
		lastOpenedAt: timestamp,
		available: true,
	};
	const instructions = new CodingInstructions(agentDirectory);
	const initial = await instructions.get(project);
	writeFileSync(filePath, 'external edit');

	await expect(
		instructions.save(project, { content: 'Kucedr edit', expectedRevision: initial.revision })
	).rejects.toThrow('changed outside Kucedr');
	expect(readFileSync(filePath, 'utf8')).toBe('external edit');
});

it('reports symbolic links as read-only and rejects saving them', async () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-coding-instructions-'));
	const agentDirectory = path.join(root, 'coding-global');
	const projectDirectory = path.join(root, 'project');
	mkdirSync(agentDirectory);
	mkdirSync(projectDirectory);
	const target = path.join(root, 'outside.md');
	writeFileSync(target, 'outside');
	symlinkSync(target, path.join(projectDirectory, 'AGENTS.md'));
	const project: CodingProject = {
		id: 'project',
		name: 'project',
		directory: projectDirectory,
		kind: 'external',
		createdAt: timestamp,
		lastOpenedAt: timestamp,
		available: true,
	};
	const instructions = new CodingInstructions(agentDirectory);
	const initial = await instructions.get(project);

	expect(initial).toMatchObject({ content: 'outside', exists: true, editable: false });
	await expect(
		instructions.save(project, { content: 'changed', expectedRevision: initial.revision })
	).rejects.toThrow('symbolic link');
	expect(readFileSync(target, 'utf8')).toBe('outside');
});

it('rejects existing and submitted content above 256 KiB', async () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-coding-instructions-'));
	const agentDirectory = path.join(root, 'coding-global');
	const projectDirectory = path.join(root, 'project');
	mkdirSync(agentDirectory);
	mkdirSync(projectDirectory);
	const project: CodingProject = {
		id: 'project',
		name: 'project',
		directory: projectDirectory,
		kind: 'external',
		createdAt: timestamp,
		lastOpenedAt: timestamp,
		available: true,
	};
	const instructions = new CodingInstructions(agentDirectory);
	const initial = await instructions.get(project);

	await expect(
		instructions.save(project, {
			content: 'a'.repeat(256 * 1024 + 1),
			expectedRevision: initial.revision,
		})
	).rejects.toThrow('256 KiB');
	writeFileSync(path.join(projectDirectory, 'AGENTS.md'), 'a'.repeat(256 * 1024 + 1));
	await expect(instructions.get(project)).rejects.toThrow('256 KiB');
});
