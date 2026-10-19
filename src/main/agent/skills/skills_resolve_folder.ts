import path from 'node:path';
import fs from 'node:fs';
import { pluginDirs } from '../../plugins/plugins_dirs';
import { skillsRoot } from './skills_root';

export function resolveSkillFolder(id: string): string {
	if (!/^[a-z0-9._-]+$/i.test(id) || id === '.' || id === '..') {
		throw new Error(`Invalid skill id: "${id}".`);
	}
	const folder = path.resolve(skillsRoot, id);
	if (path.dirname(folder) !== path.resolve(skillsRoot)) {
		throw new Error(`Skill id "${id}" escapes the skills root.`);
	}
	if (fs.existsSync(folder)) return folder;
	const plugin = pluginDirs('skills').find((entry) =>
		fs.existsSync(path.join(entry.directory, id))
	);
	return plugin ? path.join(plugin.directory, id) : folder;
}
