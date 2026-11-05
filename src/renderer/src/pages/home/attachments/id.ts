export function attachmentId(): string {
	if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
	return `attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
