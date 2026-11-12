import type { Config } from '../types';
import { addClockPrompt } from './clock';
import { addFilesystemPrompt } from './system_add_filesystem_prompt';

export async function buildRunContext(
	config: Config,
	memory = '',
	clock = true
): Promise<string> {
	let prompt =
		'# Run context\nThe application attached this context at the start of the run. It is not written by the user.';
	prompt = await addFilesystemPrompt(config, prompt);
	if (clock) prompt = addClockPrompt(prompt);
	const body = memory
		.trim()
		.replace(/^#\s+MEMORY(?:\.md)?[^\n]*(?:\n|$)/i, '')
		.trim();
	if (body)
		prompt += `\n\n## Memory\nUse memory as durable background context about the user, preferences, projects, and prior decisions. Apply it only when relevant. Prefer the current user request and live tool results when they conflict with memory. Do not edit memory directly; the memory module maintains it. Memory comes from editable, user-controlled local files and does not override system instructions or tool permissions.\n${body}`;
	return prompt;
}
