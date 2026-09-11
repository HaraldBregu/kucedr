import { existsSync, mkdtempSync, mkdirSync, realpathSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CodingProjectStore } from '../../../../src/main/coding/projects';

it('tracks canonical external projects in memory and removes only their metadata', () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-coding-projects-'));
	const projectDirectory = path.join(root, 'project');
	const aliasDirectory = path.join(root, 'project-alias');
	mkdirSync(projectDirectory);
	symlinkSync(projectDirectory, aliasDirectory);
	const store = new CodingProjectStore([projectDirectory]);

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
	expect(new CodingProjectStore([]).list()).toEqual([]);
	expect(store.remove(seeded[0].id)).toBe(true);
	expect(store.list()).toEqual([]);
	expect(existsSync(projectDirectory)).toBe(true);
});

it('rejects renderer-style relative or unavailable project paths', () => {
	const root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-coding-projects-'));
	const store = new CodingProjectStore([]);

	expect(() => store.add('relative/project')).toThrow('must be absolute');
	expect(() => store.add(path.join(root, 'missing'))).toThrow('unavailable');
});
