import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { agentLocation } from '../shared/agent_location';
import { userDataLocation } from '../shared/user_data_location';
import { soulSchema, type SoulSettings } from './schema';

export async function getSoul(workspace = agentLocation()): Promise<SoulSettings | null> {
	try {
		return soulSchema.parse(JSON.parse(await readFile(path.join(userDataLocation(), 'soul', 'settings.json'), 'utf8')));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
	for (const file of [
		path.join(userDataLocation(), 'soul', 'SOUL.md'),
		path.join(workspace, 'SOUL.md'),
	]) {
		try {
			const content = await readFile(file, 'utf8');
			const tone = content.replace(/^#\s+SOUL\.md[^\n]*(?:\n|$)/im, '').trim();
			return tone ? soulSchema.parse({ tone }) : null;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
	}
	return null;
}
