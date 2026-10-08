import { z } from 'zod';
import { tool } from '../tool';
import { activateSkill } from '../../skills';
import type { SkillLoadResult, SkillRegistrySnapshot } from '../../../../shared/skills_types';
import type { Tool } from '../../types';

export function loadSkillTool(
	snapshot: SkillRegistrySnapshot,
	onActivate: (skill: SkillLoadResult) => void
): Tool | undefined {
	const names = snapshot.skills.map((skill) => skill.name);
	if (names.length === 0) return undefined;
	return tool({
		id: 'load_skill',
		name: 'Load skill',
		description:
			'Load one Agent Skill by exact name for this run only when the user explicitly asks to load or use it. Its protected instructions and canonical resource root are injected on the next model turn.',
		planSafe: true,
		inputSchema: z.object({
			name: z.enum(names as [string, ...string[]]).describe('The exact skill name to activate.'),
		}),
		execute: async ({ name }) => {
			const skill = await activateSkill(snapshot, name);
			onActivate(skill);
			return {
				activated: true,
				id: skill.id,
				name: skill.name,
				canonicalRoot: skill.canonicalRoot,
				hash: skill.hash,
				trust: skill.trust,
				resources: skill.resources,
				warnings: skill.warnings,
			};
		},
	});
}
