import fs from 'node:fs/promises';
import path from 'node:path';
import { parseMessages } from '../agent/session/session_parse_messages';
import { sessionsRoot } from '../agent/session/session_sessions_root';
import { fingerprint } from './fingerprint';
import type { SourceSession } from './types';

export async function scanSources(location: string): Promise<SourceSession[]> {
	const root = sessionsRoot(location);
	const directories = await fs.readdir(root, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return [];
		throw error;
	});
	const sessions: SourceSession[] = [];
	for (const directory of directories) {
		if (!directory.isDirectory() || !/^[a-f0-9-]{36}$/i.test(directory.name)) continue;
		const folder = path.join(root, directory.name);
		try {
			const info = JSON.parse(await fs.readFile(path.join(folder, 'info.json'), 'utf8')) as { type?: string };
			if (info.type !== 'main' && info.type !== 'voice') continue;
			const messages = parseMessages(await fs.readFile(path.join(folder, 'messages.json'), 'utf8'));
			if (!messages) throw new Error('A conversation could not be read; memory processing will retry.');
			const occurrences = new Map<string, number>();
			const source: SourceSession = { id: directory.name, messages: [] };
			for (const message of messages) {
				if (message.role !== 'user' && message.role !== 'assistant') continue;
				const text = typeof message.content === 'string' ? message.content : message.content
					.filter((block) => block.type === 'text' && block.internal !== true && typeof block.text === 'string')
					.map((block) => block.text as string).join('\n');
				if (!text.trim()) continue;
				const digest = fingerprint(`${message.role}:${text}`);
				const occurrence = occurrences.get(digest) ?? 0;
				occurrences.set(digest, occurrence + 1);
				for (let offset = 0; offset < text.length; offset += 4000) {
					source.messages.push({ fingerprint: fingerprint(`${digest}:${occurrence}:${offset}`), role: message.role, text: text.slice(offset, offset + 4000) });
				}
			}
			sessions.push(source);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
	}
	return sessions.sort((left, right) => left.id.localeCompare(right.id));
}
