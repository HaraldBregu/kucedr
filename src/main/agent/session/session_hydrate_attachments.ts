import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { Message } from '../types';
import { sessionFolderName } from './session_session_folder_name';
import { sessionPath } from './session_session_path';

export function hydrateAttachments(
	messages: Message[],
	sessionsPath: string,
	sessionId: string
): Message[] {
	return messages.map((message) => ({
		...message,
		content:
			typeof message.content === 'string'
				? message.content
				: message.content.map((block) => {
						if (block.type !== 'image' && block.type !== 'document' && block.type !== 'file')
							return block;
						if (!block.attachment || typeof block.attachment !== 'object') return block;
						const { id, bytes } = block.attachment as Record<string, unknown>;
						if (
							typeof id !== 'string' ||
							!/^[a-f0-9]{64}$/.test(id) ||
							typeof bytes !== 'number' ||
							!Number.isInteger(bytes) ||
							bytes < 0
						)
							return { type: 'text', text: '[invalid attachment metadata omitted]' };
						const filePath = sessionPath(
							sessionsPath,
							sessionFolderName(sessionId),
							'attachments',
							`${id}.blob`
						);
						if (!existsSync(filePath)) {
							return { type: 'text', text: '[missing attachment payload omitted]' };
						}
						const payload = readFileSync(filePath);
						if (
							payload.length !== bytes ||
							createHash('sha256').update(payload).digest('hex') !== id
						) {
							return { type: 'text', text: '[corrupt attachment payload omitted]' };
						}
						const { attachment: _attachment, ...metadata } = block;
						return { ...metadata, base64: payload.toString('base64') };
					}),
	}));
}
