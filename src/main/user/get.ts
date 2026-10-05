import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { agentLocation } from '../shared/agent_location';
import { userDataLocation } from '../shared/user_data_location';
import { userSchema, type UserSettings } from './schema';

export async function getUser(workspace = agentLocation()): Promise<UserSettings | null> {
	try {
		return userSchema.parse(JSON.parse(await readFile(path.join(userDataLocation(), 'user', 'settings.json'), 'utf8')));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
	for (const file of [
		path.join(userDataLocation(), 'user', 'USER.md'),
		path.join(workspace, 'USER.md'),
	]) {
		try {
			const content = await readFile(file, 'utf8');
			const fields = Object.fromEntries(
				[...content.matchAll(/^\s*-\s*\*\*(Name|Title|What to call them|Pronouns|Timezone|Projects|Preferences):\*\*\s*(.*)$/gim)]
					.map(([, key, value]) => [key.toLowerCase(), value.trim()])
			);
			const name = fields.name || content.match(/^#\s+(?!USER\.md\b)(.+)$/im)?.[1]?.trim();
			if (!name) return null;
			const remaining = content
				.replace(/^#\s+USER\.md[^\n]*(?:\n|$)/im, '')
				.replace(/^\s*-\s*\*\*(?:Name|Title|What to call them|Pronouns|Timezone|Projects|Preferences):\*\*.*$/gim, '')
				.trim();
			return userSchema.parse({
				name,
				...(fields.title ? { title: fields.title } : {}),
				...(fields['what to call them'] ? { preferredName: fields['what to call them'] } : {}),
				...(fields.pronouns ? { pronouns: fields.pronouns } : {}),
				...(fields.timezone ? { timezone: fields.timezone } : {}),
				...(fields.projects ? { projects: fields.projects } : {}),
				...(fields.preferences ? { preferences: fields.preferences } : {}),
				...(remaining ? { notes: remaining } : {}),
			});
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
	}
	return null;
}
