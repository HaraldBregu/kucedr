import type { LoadedSkill } from '../context';

export function buildLoadedSkillPrompt(loadedSkills: LoadedSkill[]): string {
	if (loadedSkills.length === 0) return '';
	let prompt =
		'# Skills\n\nFollow the loaded instructions below. Resolve bundled scripts, references, and assets against the returned skill directory, and load only the resource files required by those instructions.';
	for (const skill of loadedSkills) {
		prompt += `\n\n<skill_content ${JSON.stringify({ id: skill.id, name: skill.name, canonicalRoot: skill.canonicalRoot, hash: skill.hash })}>`;
		if (skill.resources.length > 0) {
			prompt += `\n<skill_resources>\n${skill.resources.map((resource) => `- ${resource}`).join('\n')}\n</skill_resources>`;
		}
		if (skill.warnings && skill.warnings.length > 0) {
			prompt += `\n<skill_warnings>\n${skill.warnings.map((warning) => `- ${warning.code}: ${warning.message}`).join('\n')}\n</skill_warnings>`;
		}
		prompt += `\n<instructions>\n${skill.instructions}\n</instructions>\n</skill_content>`;
	}
	return prompt;
}
