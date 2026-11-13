import type { SkillInfo } from '../../../shared/skills_types';
import { createSkillRegistrySnapshot } from './skills_registry';

export function list(): SkillInfo[] {
	const { skills, invalid } = createSkillRegistrySnapshot();
	return [
		...skills,
		...invalid.filter((entry) => !skills.some((skill) => skill.id === entry.id)),
	].sort((a, b) => a.name.localeCompare(b.name));
}
