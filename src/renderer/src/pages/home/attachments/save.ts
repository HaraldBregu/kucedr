import type { PromptAttachment } from './types';
import { DRAFT_STORAGE_KEY } from './read';

export function saveDraftAttachments(sessionId: string, attachments: readonly PromptAttachment[]): void {
	try {
		const drafts = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) ?? '{}') as Record<string, unknown>;
		const next = drafts && typeof drafts === 'object' && !Array.isArray(drafts) ? drafts : {};
		next[sessionId] = attachments
			.filter((attachment) => attachment.path)
			.map((attachment) => ({
				path: attachment.path,
				name: attachment.file.name,
				mimeType: attachment.file.type,
			}));
		localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(next));
	} catch {
		return;
	}
}
