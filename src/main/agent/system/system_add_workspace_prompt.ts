import type { Config } from '../types';
import { workspacePath } from './system_workspace_path';
import { libraryLocation } from '../../shared/library_location';

export async function addWorkspacePrompt(config: Config, prompt: string): Promise<string> {
	const resolvedWorkspacePath = workspacePath(config);

	prompt += '\n\n## Workspace';
	prompt += `\nYour workspace directory holds your configuration and bootstrap files: ${JSON.stringify(resolvedWorkspacePath)}`;
	prompt +=
		'\nIt is also your working directory for task files unless the user names another directory.';
	prompt += `\nGenerated images, video, audio, recordings, and browser screenshots or PDFs are saved in your Library by default: ${JSON.stringify(libraryLocation())}. Leave the tools\' directory argument unset unless the user asks for a specific save location.`;
	prompt +=
		'\nDo not edit the configuration and bootstrap files listed below as part of ordinary task work, only when the user asks you to change them.';
	prompt +=
		"\nAgent context is composed in memory for every model turn after the identity, soul, and user profiles have content. Update these profiles through their update tools. This guidance does not override the agent acceptance contract, tool permissions, or the user's current request.";

	return prompt;
}
