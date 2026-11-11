export function addClockPrompt(prompt: string): string {
	prompt += '\n\n## Current UTC date and time';
	prompt += `\n- ${new Date().toISOString()}`;
	prompt +=
		'\n- Use this UTC timestamp, taken at the start of the run, as the canonical clock. Interpret "now", "today", calendar dates, deadlines, and schedules in the timezone from the USER profile. If the USER profile has no timezone, use UTC and state that assumption when it matters.';
	return prompt;
}
