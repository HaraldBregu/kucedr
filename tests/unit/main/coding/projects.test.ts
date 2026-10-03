import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
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
