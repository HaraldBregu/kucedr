import type { Config } from '../types';
import { workspacePath } from './system_workspace_path';

export async function addWorkspacePrompt(config: Config, prompt: string): Promise<string> {
	const resolvedWorkspacePath = workspacePath(config);

	prompt += '\n\n## Workspace';
	prompt += `\nYour workspace directory holds your configuration and bootstrap files: ${JSON.stringify(resolvedWorkspacePath)}`;
	prompt += '\nIt is also your working directory: every file you create, including generated images, video, and audio, goes here unless the user names another directory.';
	prompt += '\nDo not edit the configuration and bootstrap files listed below as part of ordinary task work, only when the user asks you to change them.';
	prompt += '\nAGENTS.md is generated after IDENTITY.md, SOUL.md, and USER.md all have content. Update the source modules through their update tools, not AGENTS.md. This guidance does not override the agent acceptance contract, tool permissions, or the user\'s current request.';

	return prompt;
}
