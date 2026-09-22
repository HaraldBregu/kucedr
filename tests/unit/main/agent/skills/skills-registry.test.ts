import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSkillRegistrySnapshot } from '../../../../../src/main/agent/skills/skills_registry';

function writeSkill(root: string, relativePath: string, name: string, description = name): string {
	const folder = path.join(root, relativePath, name);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, 'SKILL.md'),
		`---\nname: ${name}\ndescription: ${description}\n---\n${name} instructions`
	);
	return folder;
}

describe('createSkillRegistrySnapshot', () => {
	it('discovers nested project and user skills while ignoring unrelated directories', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-skill-registry-'));
		const projectRoot = path.join(root, 'project');
		const userRoot = path.join(root, 'user');
		try {
			writeSkill(projectRoot, 'resources/skills', 'project-writer');
			writeSkill(userRoot, 'collections/documents', 'user-reader');
			fs.mkdirSync(path.join(projectRoot, 'unrelated'), { recursive: true });
			fs.mkdirSync(path.join(projectRoot, 'node_modules', 'ignored'), { recursive: true });
			writeSkill(path.join(projectRoot, 'node_modules'), '', 'ignored');

			const snapshot = createSkillRegistrySnapshot({ projectRoot, userRoot });

			expect(snapshot.skills.map((skill) => skill.name)).toEqual(['project-writer', 'user-reader']);
			expect(snapshot.diagnostics).toEqual([]);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	it('prefers project skills and reports malformed and shadowed candidates', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-skill-precedence-'));
		const projectRoot = path.join(root, 'project');
		const userRoot = path.join(root, 'user');
		try {
			const projectSkill = writeSkill(projectRoot, 'skills', 'writer', 'Project writer');
			writeSkill(userRoot, '', 'writer', 'User writer');
			const malformed = path.join(userRoot, 'malformed');
			fs.mkdirSync(malformed, { recursive: true });
			fs.writeFileSync(path.join(malformed, 'SKILL.md'), '---\nname: malformed\n---\nbody');

			const snapshot = createSkillRegistrySnapshot({ projectRoot, userRoot });

			expect(snapshot.skills).toHaveLength(1);
			expect(snapshot.skills[0].folderPath).toBe(projectSkill);
			expect(snapshot.diagnostics).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ code: 'duplicate-name', level: 'warning' }),
					expect.objectContaining({ code: 'missing-description', level: 'error' }),
				])
			);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	it('tolerates missing roots and ignores skill directories reached through symlinks', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-skill-symlink-'));
		const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-skill-outside-'));
		try {
			const externalSkill = writeSkill(outside, '', 'external');
			fs.mkdirSync(root, { recursive: true });
			fs.symlinkSync(externalSkill, path.join(root, 'external'));

			const snapshot = createSkillRegistrySnapshot({
				projectRoot: root,
				userRoot: path.join(root, 'missing'),
			});

			expect(snapshot.skills).toEqual([]);
			expect(snapshot.diagnostics).toEqual([]);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
			fs.rmSync(outside, { recursive: true, force: true });
		}
	});
});
