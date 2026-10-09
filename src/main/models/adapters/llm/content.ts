export function content(value: unknown): string {
	if (typeof value === 'string') return value;
	if (!Array.isArray(value)) return '';
	return value
		.map((chunk) => (chunk?.type === 'text' && typeof chunk.text === 'string' ? chunk.text : ''))
		.join('');
}
