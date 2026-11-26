const SECRET_KEY =
	/(?:authorization|api[_-]?key|client[_-]?secret|password|refresh[_-]?token|token)/i;

export function redactApprovalInput(
	input: Record<string, unknown>,
	toolName?: string
): Record<string, unknown> {
	const redact = (value: unknown, key = '', depth = 0): unknown => {
		if (toolName === 'bash' && key === 'env') return value;
		if (SECRET_KEY.test(key)) {
			const length = typeof value === 'string' ? value.length : JSON.stringify(value)?.length ?? 0;
			return `[redacted, ${length} chars]`;
		}
		if (!value || typeof value !== 'object') return value;
		if (depth >= 6) return '[nested deeper than 6 levels]';
		if (Array.isArray(value)) {
			const items = value.slice(0, 50).map((item) => redact(item, key, depth + 1));
			return value.length > 50 ? [...items, `… +${value.length - 50} more`] : items;
		}
		const entries = Object.entries(value as Record<string, unknown>);
		return Object.fromEntries([
			...entries
				.slice(0, 100)
				.map(([childKey, child]) => [childKey, redact(child, childKey, depth + 1)]),
			...(entries.length > 100 ? [['…', `+${entries.length - 100} more keys`]] : []),
		]);
	};
	return redact(input) as Record<string, unknown>;
}
