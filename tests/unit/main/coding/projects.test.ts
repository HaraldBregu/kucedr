import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
jest.mock('electron-store', () => {
	const fs = require('node:fs');
	const path = require('node:path');
	return class Store {
		readonly path: string;
		constructor(options: { cwd: string; name: string; defaults: unknown }) {
			this.path = path.join(options.cwd, `${options.name}.json`);
			fs.mkdirSync(options.cwd, { recursive: true });
			if (!fs.existsSync(this.path)) fs.writeFileSync(this.path, JSON.stringify(options.defaults));
		}
		get(key: string): unknown {
			return JSON.parse(fs.readFileSync(this.path, 'utf8'))[key];
		}
		set(key: string, value: unknown): void {
			const stored = JSON.parse(fs.readFileSync(this.path, 'utf8'));
			fs.writeFileSync(this.path, JSON.stringify({ ...stored, [key]: value }));
		}
	};
});

import { CodingProjectStore } from '../../../../src/main/coding/projects';

it('creates isolated workspace folders with durable configuration stores', () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-managed-workspaces-'));
	const store = new CodingProjectStore(undefined, root);
	expect(store.list()).toEqual([]);
	const first = store.create();
	const second = store.create();
	expect(first.name).toBe('Workspace 1');
	expect(second.name).toBe('Workspace 2');
	expect(first.id).not.toBe(second.id);
	for (const workspace of [first, second]) {
		const directory = path.join(root, 'workspaces', workspace.id);
		expect(workspace.directory).toBe(realpathSync.native(path.join(directory, 'files')));
		expect(store.add(workspace.directory).id).toBe(workspace.id);
		expect(existsSync(workspace.directory)).toBe(true);
		expect(existsSync(path.join(directory, 'sessions'))).toBe(true);
		expect(JSON.parse(readFileSync(path.join(directory, 'config.json'), 'utf8'))).toMatchObject({ id: workspace.id, name: workspace.name, directory: workspace.directory });
	}
	expect(new CodingProjectStore(undefined, root).list().map((workspace) => workspace.id).sort()).toEqual([first.id, second.id].sort());
});

it('persists canonical external projects and removes only their metadata', () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-coding-projects-'));
	const projectDirectory = path.join(root, 'project');
	const aliasDirectory = path.join(root, 'project-alias');
	mkdirSync(projectDirectory);
	symlinkSync(projectDirectory, aliasDirectory);
	const store = new CodingProjectStore([projectDirectory], path.join(root, 'coder'));

	const seeded = store.list();
	expect(seeded).toHaveLength(1);
	expect(seeded[0]).toMatchObject({
		name: 'project',
		directory: realpathSync.native(projectDirectory),
		kind: 'external',
		available: true,
	});
	expect(store.add(aliasDirectory).id).toBe(seeded[0].id);
	expect(store.list()).toHaveLength(1);
	const reloaded = new CodingProjectStore([projectDirectory], path.join(root, 'coder'));
	expect(reloaded.list()[0].id).toBe(seeded[0].id);
	expect(existsSync(path.join(root, 'coder', 'projects.json'))).toBe(true);
	expect(store.remove(seeded[0].id)).toBe(true);
	expect(store.list()).toEqual([]);
	expect(new CodingProjectStore([], path.join(root, 'coder')).list()).toEqual([]);
	expect(existsSync(projectDirectory)).toBe(true);
});

it('rejects renderer-style relative or unavailable project paths', () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-coding-projects-'));
	const store = new CodingProjectStore([], path.join(root, 'coder'));

	expect(() => store.add('relative/project')).toThrow('must be absolute');
	expect(() => store.add(path.join(root, 'missing'))).toThrow('unavailable');
});


it('stores workspace configuration and restores its identity after removal', () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-coding-projects-'));
	const projectDirectory = path.join(root, 'project');
	mkdirSync(projectDirectory);
	const directory = path.join(root, 'coder');
	const store = new CodingProjectStore([], directory);
	const project = store.add(projectDirectory);
	const config = path.join(directory, 'workspaces', project.id, 'config.json');
	expect(JSON.parse(readFileSync(config, 'utf8'))).toMatchObject({ id: project.id, directory: realpathSync.native(projectDirectory) });
	expect(existsSync(path.join(directory, 'workspaces', project.id, 'sessions'))).toBe(true);
	expect(store.remove(project.id)).toBe(true);
	expect(new CodingProjectStore([], directory).list()).toEqual([]);
	expect(new CodingProjectStore([], directory).add(projectDirectory).id).toBe(project.id);
});

it('reads legacy project registrations without migrating them', () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-coding-projects-'));
	const directory = path.join(root, 'coder');
	mkdirSync(directory);
	writeFileSync(path.join(directory, 'projects.json'), JSON.stringify({ projects: [{
		id: 'legacy', name: 'Legacy', directory: root, kind: 'external',
		createdAt: '2026-01-01', lastOpenedAt: '2026-01-01',
	}] }));
	const store = new CodingProjectStore([], directory);
	expect(store.list()[0].id).toBe('legacy');
	expect(existsSync(path.join(directory, 'workspaces', 'legacy', 'config.json'))).toBe(false);
});


it('persists a named workspace configuration without accepting a working directory override', () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-coding-projects-'));
	const store = new CodingProjectStore([], root);
	const project = store.create({ name: '  Product site  ', settings: {
		runtime: 'codex', providerId: 'openai-codex', modelId: ' model-a ',
		thinkingLevel: 'high', toolMode: 'coding', workingDirectory: '/outside',
	} });
	expect(project.name).toBe('Product site');
	expect(project.directory).toBe(realpathSync.native(path.join(root, 'workspaces', project.id, 'files')));
	expect(project.settings).toEqual({
		runtime: 'codex', providerId: 'openai-codex', modelId: 'model-a',
		thinkingLevel: 'high', toolMode: 'coding',
	});
	expect(new CodingProjectStore([], root).get(project.id)).toEqual(project);
	const inherited = store.create({ name: 'Shared defaults' });
	expect(inherited.settings).toBeUndefined();
});

it.each([
	{ name: '' },
	{ name: '   ' },
	{ name: 'x'.repeat(121) },
	{ name: 12 },
	{ name: 'Invalid harness', settings: { runtime: 'other' } },
	{ name: 'Wrong provider', settings: { runtime: 'codex', providerId: 'anthropic', modelId: '', thinkingLevel: 'medium', toolMode: 'coding' } },
	{ name: 'Wrong provider', settings: { runtime: 'pi', providerId: 'cline', modelId: '', thinkingLevel: 'medium', toolMode: 'coding' } },
	{ name: 'Wrong provider', settings: { runtime: 'cline', providerId: 'openai', modelId: '', thinkingLevel: 'medium', toolMode: 'coding' } },
])('rejects invalid creation before creating a workspace: %j', (input) => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-coding-projects-'));
	const store = new CodingProjectStore([], root);
	expect(() => store.create(input as never)).toThrow('Invalid Coder workspace configuration');
	expect(readdirSync(path.join(root, 'workspaces'))).toEqual([]);
	expect(store.list()).toEqual([]);
});
