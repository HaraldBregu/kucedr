import fs from 'node:fs';
import path from 'node:path';
import type { SkillInfo } from '../../../shared/skills_types';
import { pluginDirs } from '../../plugins/plugins_dirs';
import { skillsRoot } from './skills_root';
import { readSkill } from './skills_read';

export function list(): SkillInfo[] {
	const skills: SkillInfo[] = [];
	for (const { directory, plugin } of [{ directory: skillsRoot }, ...pluginDirs('skills')]) {
		if (!fs.existsSync(directory)) continue;
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			if (!entry.isDirectory() || skills.some((skill) => skill.id === entry.name)) continue;
			const info = readSkill(path.join(directory, entry.name), entry.name);
			if (info) skills.push(plugin ? { ...info, plugin } : info);
		}
	}
	return skills.sort((a, b) => a.name.localeCompare(b.name));
}
