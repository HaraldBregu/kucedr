import type { InitialItem } from 'openai/resources/live/live';
import type { RealtimeVoiceHistoryMessage } from './realtime_voice_types';

export function liveVoiceHistory(history: readonly RealtimeVoiceHistoryMessage[]): InitialItem[] {
	let remaining = 6000;
	const selected: InitialItem[] = [];
	for (const message of history.slice(-64).toReversed()) {
		if (remaining <= 0) break;
		const text = Buffer.from(message.text).subarray(-remaining).toString('utf8');
		remaining -= Buffer.byteLength(text);
		if (!text.trim()) continue;
		selected.push(message.role === 'user'
			? { type: 'message', role: 'user', content: [{ type: 'input_text', text }] }
			: { type: 'message', role: 'assistant', content: [{ type: 'text', text }] });
	}
	return selected.reverse();
}
