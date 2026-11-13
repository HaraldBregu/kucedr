import fs from 'node:fs';
import path from 'node:path';
import type {
	SkillDiagnostic,
	SkillInfo,
	SkillRegistrySnapshot,
	SkillSource,
} from '../../../shared/skills_types';
import type { PluginSource } from '../../../shared/plugin_types';
import { skillsRoot } from './skills_root';
import { readSkill } from './skills_read';
import { validateSkill } from './skills_validate';
import { pluginDirs } from '../../plugins/plugins_dirs';

export function createSkillRegistrySnapshot(): SkillRegistrySnapshot {
	const skills: SkillInfo[] = [];
	const invalid: SkillInfo[] = [];
	const diagnostics: SkillDiagnostic[] = [];
	const roots: { directory: string; source: SkillSource; plugin?: PluginSource }[] = [
		{ directory: skillsRoot, source: 'user' },
		...pluginDirs('skills').map((entry) => ({ ...entry, source: 'plugin' as const })),
	];
	for (const { directory, source, plugin } of roots) {
		if (!fs.existsSync(directory)) continue;
		const entries = fs
			.readdirSync(directory, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
			.sort((left, right) => left.name.localeCompare(right.name));
		for (const entry of entries) {
			const folder = path.join(directory, entry.name);
			const skill = readSkill(folder, entry.name, source);
			if (!skill) {
				const issues: SkillDiagnostic[] = validateSkill(folder).issues.map((issue) => ({
					level: 'error',
					code: issue.code,
					message: issue.message,
				}));
				diagnostics.push(
					...issues.map((issue) => ({
						...issue,
						message: `${source} ${entry.name}: ${issue.message}`,
					}))
				);
				if (skills.some((existing) => existing.id === entry.name)) continue;
				invalid.push({
					id: entry.name,
					name: entry.name,
					description: '',
					folderPath: folder,
					manifest: { name: entry.name, description: '' },
					source,
					trust: 'user-controlled',
					hash: '',
					diagnostics: issues,
					...(plugin ? { plugin } : {}),
				});
				continue;
			}
			const existing = skills.find(
				(candidate) => candidate.name.toLowerCase() === skill.name.toLowerCase()
			);
			if (existing) {
				const shadowed: SkillDiagnostic = {
					level: 'warning',
					code: 'duplicate-name',
					message: `A ${source} skill named "${skill.name}" is shadowed by this ${existing.source} skill.`,
				};
				diagnostics.push(shadowed);
				existing.diagnostics = [...(existing.diagnostics ?? []), shadowed];
				continue;
			}
			skills.push(plugin ? { ...skill, plugin } : skill);
		}
	}
	return Object.freeze({
		skills: Object.freeze(skills.map((skill) => Object.freeze(skill))),
		invalid: Object.freeze(invalid),
		diagnostics: Object.freeze(diagnostics),
	});
}
