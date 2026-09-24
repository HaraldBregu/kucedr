import type { PromptAttachment } from './types';

const STORAGE_KEY = 'kucedr-prompt-attachments';

export function saveDraftAttachments(sessionId: string, attachments: readonly PromptAttachment[]): void {
	try {
		const drafts = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;
		const next = drafts && typeof drafts === 'object' && !Array.isArray(drafts) ? drafts : {};
		next[sessionId] = attachments
			.filter((attachment) => attachment.path)
			.map((attachment) => ({
				path: attachment.path,
				name: attachment.file.name,
				mimeType: attachment.file.type,
			}));
		localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	} catch {
		return;
	}
}

export function readDraftAttachments(sessionId: string): { path: string; name: string; mimeType: string }[] {
	try {
		const drafts = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;
		const entries = drafts?.[sessionId];
		if (!Array.isArray(entries)) return [];
		return entries.filter((entry): entry is { path: string; name: string; mimeType: string } =>
			entry && typeof entry.path === 'string' && typeof entry.name === 'string' && typeof entry.mimeType === 'string'
		);
	} catch {
		return [];
	}
}
