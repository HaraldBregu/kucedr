export const DRAFT_STORAGE_KEY = 'kucedr-prompt-attachments';

export function readDraftAttachments(sessionId: string): { path: string; name: string; mimeType: string }[] {
	try {
		const drafts = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) ?? '{}') as Record<string, unknown>;
		const entries = drafts?.[sessionId];
		if (!Array.isArray(entries)) return [];
		return entries.filter((entry): entry is { path: string; name: string; mimeType: string } =>
			entry && typeof entry.path === 'string' && typeof entry.name === 'string' && typeof entry.mimeType === 'string'
		);
	} catch {
		return [];
	}
}
