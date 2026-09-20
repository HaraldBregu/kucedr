import path from 'node:path';
import type {
	SkillDiagnostic,
	SkillInfo,
	SkillRegistrySnapshot,
} from '../../../shared/skills_types';
import { skillsRoot } from './skills_root';
import { readSkill } from './skills_read';
import { scanSkillFolders } from './scan';
import { validateSkill } from './skills_validate';

export interface SkillRegistryOptions {
	projectRoot?: string;
	userRoot?: string;
}

export function createSkillRegistrySnapshot(
	options: SkillRegistryOptions = {}
): SkillRegistrySnapshot {
	const skills: SkillInfo[] = [];
	const diagnostics: SkillDiagnostic[] = [];
	const names = new Map<string, { name: string; scope: 'project' | 'user' }>();
	const sources = [
		...(options.projectRoot ? [{ root: options.projectRoot, scope: 'project' as const }] : []),
		{ root: options.userRoot ?? skillsRoot, scope: 'user' as const },
	];
	for (const source of sources) {
		for (const folder of scanSkillFolders(source.root)) {
			const validation = validateSkill(folder);
			if (!validation.valid) {
				for (const issue of validation.issues) {
					diagnostics.push({
						level: 'error',
						code: issue.code,
						message: `${source.scope} ${path.relative(source.root, folder) || path.basename(folder)}: ${issue.message}`,
					});
				}
				continue;
			}
			const skill = readSkill(folder, path.basename(folder));
			if (!skill) continue;
			const key = skill.name.toLowerCase();
			const existing = names.get(key);
			if (existing) {
				diagnostics.push({
					level: 'warning',
					code: 'duplicate-name',
					message: `Skill "${skill.name}" from ${source.scope} is shadowed by ${existing.scope} skill "${existing.name}".`,
				});
				continue;
			}
			names.set(key, { name: skill.name, scope: source.scope });
			skills.push(Object.freeze(skill));
		}
	}
	return Object.freeze({ skills: Object.freeze(skills), diagnostics: Object.freeze(diagnostics) });
}
