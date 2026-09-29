export function realtimeVoiceCloseError(
	code: unknown,
	reason: unknown,
	fallback: string
): Error | null {
	const event = code && typeof code === 'object' ? code : undefined;
	const closeCode =
		typeof code === 'number'
			? code
			: event && 'code' in event && typeof event.code === 'number'
				? event.code
				: undefined;
	const rawReason =
		typeof reason === 'string'
			? reason
			: reason && typeof reason === 'object'
				? String(reason)
				: event && 'reason' in event && typeof event.reason === 'string'
					? event.reason
					: '';
	const closeReason = rawReason.trim();
	if (closeCode === 1000 && !closeReason) return null;
	const detail = closeReason || (closeCode ? `code ${closeCode}` : 'unexpectedly');
	return new Error(`${fallback} (${detail}).`);
}
