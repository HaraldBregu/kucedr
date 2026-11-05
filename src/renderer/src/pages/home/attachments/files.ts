import { attachmentId } from './id';
import { attachmentPath } from './path';
import type { PromptAttachment } from './types';

export function filesToAttachments(files: File[]): PromptAttachment[] {
	return files.map((file) => ({
		id: attachmentId(),
		kind: 'file',
		file,
		path: attachmentPath(file) || undefined,
	}));
}
