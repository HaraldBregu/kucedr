import fs from 'node:fs/promises';
import path from 'node:path';
import { agentLocation } from '../../../shared/agent_location';
import { resolveUserPath } from '../../../shared/user_path';

const MIME_TYPES: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.gif': 'image/gif',
	'.mp3': 'audio/mpeg',
	'.wav': 'audio/wav',
	'.ogg': 'audio/ogg',
	'.m4a': 'audio/mp4',
};

export async function inlineFiles(value: unknown, key?: string): Promise<unknown> {
	if (key === 'url' && typeof value === 'string' && !/^(https?|data):/i.test(value)) {
		const filePath = resolveUserPath(value, agentLocation());
		const mimeType = MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
		return `data:${mimeType};base64,${(await fs.readFile(filePath)).toString('base64')}`;
	}
	if (Array.isArray(value)) return Promise.all(value.map((item) => inlineFiles(item)));
	if (value && typeof value === 'object') {
		const entries = await Promise.all(
			Object.entries(value).map(async ([name, item]) => [name, await inlineFiles(item, name)])
		);
		return Object.fromEntries(entries);
	}
	return value;
}
