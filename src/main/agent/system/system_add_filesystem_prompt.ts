import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Config } from '../types';
import { libraryLocation } from '../../shared/library_location';

export async function addFilesystemPrompt(config: Config, prompt: string): Promise<string> {
	const root = path.resolve(config.location);
	const paths: string[] = [];
	let entries: Dirent[] = [];
	let unavailable = false;
	try {
		entries = await fs.readdir(root, { withFileTypes: true });
	} catch {
		unavailable = true;
	}

	for (const entry of entries)
		paths.push(entry.isDirectory() ? `${entry.name}/` : entry.name);

	paths.sort();

	prompt += '\n\n## Agent filesystem';
	prompt += `\nRoot directory: ${JSON.stringify(root)}`;
	prompt += '\nThis inventory is refreshed before every model turn and contains path names only, not file contents.';
	prompt += '\nOnly files and folders directly inside the root directory are listed. Folder names end with `/`.';
	prompt += '\nWrite relative paths for task files in this root unless the user asks for another location.';
	prompt += `\nMedia generation, recorder, and browser screenshot or PDF tools save to Library by default: ${JSON.stringify(libraryLocation())}. Leave their \`directory\` argument unset; set it only when the user asks for a specific save location.`;
	if (paths.length === 0 && !unavailable) return `${prompt}\n- (empty)`;
	for (const filePath of paths) prompt += `\n- ${JSON.stringify(filePath)}`;
	if (unavailable) prompt += '\n- "." (unavailable)';
	return prompt;
}
