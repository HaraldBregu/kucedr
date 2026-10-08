export function requestsSkillTools(message: string, explicitSkill?: string): boolean {
	if (explicitSkill) return true;
	return (
		/\b(?:list|show|inspect|browse|what|which)\b.{0,40}\bskills?\b/iu.test(message) ||
		/\b(?:load|use|apply|activate|run)\b.{0,60}\bskills?\b/iu.test(message) ||
		/\bskills?\b.{0,40}\b(?:list|load|use|apply|activate|run)\b/iu.test(message)
	);
}
