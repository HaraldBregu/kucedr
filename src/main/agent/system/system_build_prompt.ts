import type { LoadedSkill } from '../context';
import type { Config, Tool } from '../types';
import { addBasePrompt } from './system_add_base_prompt';
import { addFilesystemPrompt } from './system_add_filesystem_prompt';
import { addSkillPrompt } from './system_add_skill_prompt';
import { addToolsPrompt } from './system_add_tools_prompt';
import { addWorkspacePrompt } from './system_add_workspace_prompt';

export async function buildSystemPrompt(
	config: Config,
	tools: Tool[] = [],
	loadedSkills: LoadedSkill[] = [],
	basePrompt?: string,
	contextMode: 'minimal' | 'workspace' = 'workspace',
	hasAvailableSkills = loadedSkills.length > 0
): Promise<string> {
	let prompt = basePrompt ?? addBasePrompt('');
	if (basePrompt === undefined) {
		prompt = addToolsPrompt(prompt, tools);
		if (contextMode === 'workspace') prompt = await addWorkspacePrompt(config, prompt);
	}
	prompt = await addFilesystemPrompt(config, prompt);
	prompt = addSkillPrompt(prompt, [], hasAvailableSkills);
	return prompt;
}
