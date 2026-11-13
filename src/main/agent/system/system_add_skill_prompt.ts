export function addSkillPrompt(prompt: string, hasAvailableSkills: boolean): string {
	if (!hasAvailableSkills) return prompt;
	return (
		prompt +
		'\n\n# Skills\n\nSkills can be discovered and activated only through `list_skills` and `load_skill`. Call those tools only when the user explicitly asks to list, load, or use skills. A request merely matching a skill description is not authorization to call a skill tool. Do NOT load skills to answer questions about them (e.g. listing or describing available skills).'
	);
}
