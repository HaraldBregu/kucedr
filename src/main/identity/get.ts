import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { agentLocation } from '../shared/agent_location';
import { userDataLocation } from '../shared/user_data_location';
import { identitySchema, type IdentitySettings } from './schema';

	export async function getIdentity(workspace = agentLocation()): Promise<IdentitySettings | null> {
	try {
		return identitySchema.parse(JSON.parse(await readFile(path.join(userDataLocation(), 'identity', 'settings.json'), 'utf8')));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
	for (const file of [
		path.join(userDataLocation(), 'identity', 'IDENTITY.md'),
		path.join(workspace, 'IDENTITY.md'),
	]) {
		try {
			const content = await readFile(file, 'utf8');
			const fields = Object.fromEntries(
				[...content.matchAll(/^\s*-\s*\*\*(Name|Role|Avatar|Vibe|Metadata):\*\*\s*(.*)$/gim)]
					.map(([, key, value]) => [key.toLowerCase(), value.trim()])
			);
			const name = fields.name || content.match(/^#\s+(?!IDENTITY\.md\b)(.+)$/im)?.[1]?.trim();
			if (!name) return null;
			const remaining = content
				.replace(/^#\s+IDENTITY\.md[^\n]*(?:\n|$)/im, '')
				.replace(/^\s*-\s*\*\*(?:Name|Role|Avatar|Vibe|Metadata):\*\*.*$/gim, '')
				.trim();
			const metadata = [fields.metadata, remaining].filter(Boolean).join('\n\n');
			return identitySchema.parse({
				name,
				role: fields.role || 'Assistant',
				...(fields.avatar ? { avatar: fields.avatar } : {}),
				...(fields.vibe ? { vibe: fields.vibe } : {}),
				...(metadata ? { metadata } : {}),
			});
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
	}
	return null;
}
