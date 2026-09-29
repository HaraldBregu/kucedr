export function realtimeVoiceResponseError(response: {
	readonly status?: string;
	readonly status_details?: {
		readonly error?: { readonly message?: string };
		readonly reason?: string;
	} | null;
}): string | null {
	if (response.status !== 'failed' && response.status !== 'incomplete') return null;
	return (
		response.status_details?.error?.message?.trim() ||
		response.status_details?.reason?.trim() ||
		'Realtime voice response failed.'
	);
}
