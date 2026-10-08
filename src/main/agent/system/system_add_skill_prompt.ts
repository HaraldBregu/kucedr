import type { LoadedSkill } from '../context';

export function addSkillPrompt(
	prompt: string,
	loadedSkills: LoadedSkill[] = [],
	hasAvailableSkills = loadedSkills.length > 0
): string {
	if (!hasAvailableSkills && loadedSkills.length === 0) return prompt;
	prompt += '\n\n# Skills';
	if (hasAvailableSkills) {
		prompt +=
			'\n\nSkills can be discovered and activated only through `list_skills` and `load_skill`. Call those tools only when the user explicitly asks to list, load, or use skills. A request merely matching a skill description is not authorization to call a skill tool. Do NOT load skills to answer questions about them (e.g. listing or describing available skills).';
	}
	if (loadedSkills.length > 0) {
		prompt +=
			'\n\nFollow the loaded instructions below. Resolve bundled scripts, references, and assets against the returned skill directory, and load only the resource files required by those instructions.';
		for (const skill of loadedSkills) {
			prompt += `\n\n<skill_content ${JSON.stringify({ id: skill.id, name: skill.name, canonicalRoot: skill.canonicalRoot, hash: skill.hash, trust: skill.trust })}>`;
			if (skill.resources.length > 0) {
				prompt += `\n<skill_resources>\n${skill.resources.map((resource) => `- ${resource}`).join('\n')}\n</skill_resources>`;
			}
			if (skill.warnings && skill.warnings.length > 0) {
				prompt += `\n<skill_warnings>\n${skill.warnings.map((warning) => `- ${warning.code}: ${warning.message}`).join('\n')}\n</skill_warnings>`;
			}
			prompt += `\n<instructions>\n${skill.instructions}\n</instructions>\n</skill_content>`;
		}
	}
	return prompt;
}
