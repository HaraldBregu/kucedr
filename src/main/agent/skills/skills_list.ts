import type { SkillInfo } from '../../../shared/skills_types';
import { createSkillRegistrySnapshot } from './skills_registry';

export function list(): SkillInfo[] {
	const snapshot = createSkillRegistrySnapshot();
	return [...snapshot.skills, ...snapshot.invalid].sort((a, b) => a.name.localeCompare(b.name));
}
