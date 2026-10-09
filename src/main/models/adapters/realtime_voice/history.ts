import type { InitialItem } from 'openai/resources/live/live';
import type { RealtimeVoiceHistoryMessage } from './realtime_voice_types';

const MAX_HISTORY_BYTES = 6000;
const MAX_HISTORY_MESSAGES = 64;

export function liveVoiceHistory(history: readonly RealtimeVoiceHistoryMessage[]): InitialItem[] {
	let remaining = MAX_HISTORY_BYTES;
	const selected: InitialItem[] = [];
	for (const message of history.slice(-MAX_HISTORY_MESSAGES).toReversed()) {
		if (remaining <= 0) break;
		const bytes = Buffer.from(message.text);
		let offset = Math.max(0, bytes.length - remaining);
		while (offset < bytes.length && (bytes[offset] & 0xc0) === 0x80) offset += 1;
		const text = bytes.subarray(offset).toString('utf8');
		remaining -= Buffer.byteLength(text);
		if (!text.trim()) continue;
		selected.push(
			message.role === 'user'
				? { type: 'message', role: 'user', content: [{ type: 'input_text', text }] }
				: { type: 'message', role: 'assistant', content: [{ type: 'text', text }] }
		);
	}
	return selected.reverse();
}
