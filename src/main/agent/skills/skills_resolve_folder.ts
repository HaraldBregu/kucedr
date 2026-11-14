import { list } from './skills_list';

export function resolveSkillFolder(id: string): string {
	const skill = list().find((entry) => entry.id === id);
	if (!skill) throw new Error(`Skill "${id}" not found.`);
	return skill.folderPath;
}
