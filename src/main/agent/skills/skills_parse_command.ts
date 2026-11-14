export function parseSkillCommand(message: string): {
	message: string;
	explicitSkill?: string;
	unloadSkill?: string;
} {
	const off = message.match(/^\/skill\s+off\s+(\S+)\s*([\s\S]*)$/i);
	if (off) {
		return {
			message: off[2].trim() || `Stop using the "${off[1]}" skill.`,
			unloadSkill: off[1],
		};
	}
	const match = message.match(/^\/skill\s+(\S+)\s*([\s\S]*)$/i);
	if (!match) return { message };
	const userInput = match[2].trim();
	return {
		message: userInput || 'Use the explicitly selected skill.',
		explicitSkill: match[1],
	};
}
