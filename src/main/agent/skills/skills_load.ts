import type { SkillLoadResult } from '../../../shared/skills_types';
import { inspectSkill } from './skills_inspect';
import { createSkillRegistrySnapshot } from './skills_registry';

export async function loadSkill(name: string): Promise<SkillLoadResult | undefined> {
	return inspectSkill(createSkillRegistrySnapshot(), name).catch(() => undefined);
}
