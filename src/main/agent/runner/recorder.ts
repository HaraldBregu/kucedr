const BACKGROUND_RECORDER_IDS = new Set([
	'microphone_recorder',
	'camera_recorder',
	'screen_recorder',
]);

export function startsBackgroundRecorder(call: import('../types').ToolCall): boolean {
	if (!BACKGROUND_RECORDER_IDS.has(call.name) || call.result?.isError) return false;
	if (typeof call.result?.content !== 'string') return false;
	try {
		const result = JSON.parse(call.result.content) as { id?: unknown };
		return typeof result.id === 'string' && result.id.length > 0;
	} catch {
		return false;
	}
}
