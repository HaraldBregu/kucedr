import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import type { Message } from '../types';
import { sessionPath } from './session_session_path';
import type { SessionState } from './session_types';

export function externalizeAttachments(messages: Message[], state: SessionState): Message[] {
	return messages.map((message) => ({
		...message,
		content:
			typeof message.content === 'string'
				? message.content
				: message.content.map((block) => {
						if (
							(block.type !== 'image' && block.type !== 'document' && block.type !== 'file') ||
							typeof block.base64 !== 'string'
						)
							return block;
						const bytes = Buffer.from(block.base64, 'base64');
						const id = createHash('sha256').update(bytes).digest('hex');
						const directory = sessionPath(state.sessionsPath, state.folderName, 'attachments');
						const filePath = sessionPath(
							state.sessionsPath,
							state.folderName,
							'attachments',
							`${id}.blob`
						);
						mkdirSync(directory, { recursive: true });
						if (existsSync(filePath)) {
							const stored = readFileSync(filePath);
							if (stored.length !== bytes.length || !stored.equals(bytes)) {
								throw new Error(`Attachment blob checksum mismatch: ${id}`);
							}
						} else {
							const temporaryPath = sessionPath(
								state.sessionsPath,
								state.folderName,
								'attachments',
								`.${id}.${process.pid}.${Date.now()}.tmp`
							);
							try {
								writeFileSync(temporaryPath, bytes, { flag: 'wx' });
								renameSync(temporaryPath, filePath);
							} finally {
								if (existsSync(temporaryPath)) rmSync(temporaryPath, { force: true });
							}
						}
						const { base64: _base64, ...metadata } = block;
						return {
							...metadata,
							attachment: { id, bytes: bytes.length },
						};
					}),
	}));
}
