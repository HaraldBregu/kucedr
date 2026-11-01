export function formatChatAge(timestamp: number, now = Date.now()): string {
	const elapsed = Math.max(0, now - timestamp);
	const minute = 60_000;
	const hour = 60 * minute;
	const day = 24 * hour;
	if (elapsed < hour) return `${Math.max(1, Math.floor(elapsed / minute))}m`;
	if (elapsed < day) return `${Math.floor(elapsed / hour)}h`;
	if (elapsed < 7 * day) return `${Math.floor(elapsed / day)}d`;
	if (elapsed < 30 * day) return `${Math.floor(elapsed / (7 * day))}w`;
	if (elapsed < 365 * day) return `${Math.floor(elapsed / (30 * day))}M`;
	return String(new Date(timestamp).getFullYear());
}
