import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

jest.mock('../../../../../src/main/agent/skills/skills_root', () => ({
	skillsRoot: require('node:path').join(
		require('node:os').tmpdir(),
		`kucedr-skill-registry-${process.pid}`,
		'user'
	),
}));
jest.mock('../../../../../src/main/plugins/plugins_dirs', () => ({
	pluginDirs: () => [
		{
			directory: require('node:path').join(
				require('node:os').tmpdir(),
				`kucedr-skill-registry-${process.pid}`,
				'plugin',
				'skills'
			),
			plugin: { id: 'docs', name: 'Docs', version: '1.0.0' },
			builtIn: false,
		},
	],
}));

import { createSkillRegistrySnapshot } from '../../../../../src/main/agent/skills/skills_registry';
import { list } from '../../../../../src/main/agent/skills/skills_list';

function writeSkill(base: string, name: string, description = name): string {
	const folder = path.join(base, name);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, 'SKILL.md'),
		`---\nname: ${name}\ndescription: ${description}\n---\n${name} instructions`
	);
	return folder;
}

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('createSkillRegistrySnapshot', () => {
	it('reads only top-level user and plugin skills, tagging their source', () => {
		writeSkill(userRoot, 'user-reader');
		writeSkill(pluginRoot, 'plugin-writer');
		writeSkill(path.join(userRoot, 'collections'), 'nested');

		const snapshot = createSkillRegistrySnapshot();

		expect(snapshot.skills.map((skill) => [skill.name, skill.source])).toEqual([
			['user-reader', 'user'],
			['plugin-writer', 'plugin'],
		]);
		expect(snapshot.skills[1].plugin?.id).toBe('docs');
	});

	it('prefers user skills and reports malformed and shadowed folders', () => {
		const userSkill = writeSkill(userRoot, 'writer', 'User writer');
		writeSkill(pluginRoot, 'writer', 'Plugin writer');
		const malformed = path.join(userRoot, 'malformed');
		fs.mkdirSync(malformed, { recursive: true });
		fs.writeFileSync(path.join(malformed, 'SKILL.md'), '---\nname: malformed\n---\nbody');

		const snapshot = createSkillRegistrySnapshot();

		expect(snapshot.skills).toHaveLength(1);
		expect(snapshot.skills[0].folderPath).toBe(userSkill);
		expect(snapshot.skills[0].diagnostics).toEqual([
			expect.objectContaining({ code: 'duplicate-name', level: 'warning' }),
		]);
		expect(snapshot.invalid.map((entry) => entry.id)).toEqual(['malformed']);
		expect(snapshot.invalid[0].diagnostics).toEqual([
			expect.objectContaining({ code: 'missing-description', level: 'error' }),
		]);
		expect(list().map((entry) => entry.id)).toEqual(['malformed', 'writer']);
	});

	it('tolerates missing roots', () => {
		expect(createSkillRegistrySnapshot()).toEqual({ skills: [], invalid: [], diagnostics: [] });
	});
});
