import type { RunContext } from './context_types';

export function rememberSkill(
	context: RunContext,
	skill: RunContext['loadedSkills'][number]
): void {
	context.skillsTracked = true;
	const existing = context.loadedSkills.find((candidate) => candidate.id === skill.id);
	if (existing) Object.assign(existing, skill);
	else context.loadedSkills.push(skill);
}
