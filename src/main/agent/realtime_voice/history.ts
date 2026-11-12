import type { RealtimeVoiceHistoryMessage } from '../../models/adapters/realtime_voice';
import type { Message } from '../types';

const MAX_REALTIME_VOICE_HISTORY_MESSAGES = 64;
const MAX_REALTIME_VOICE_HISTORY_CHARACTERS = 48_000;
const LEGACY_REALTIME_VOICE_PLACEHOLDER = 'Voice message';

export function realtimeVoiceHistory(messages: readonly Message[]): RealtimeVoiceHistoryMessage[] {
	const candidates: RealtimeVoiceHistoryMessage[] = [];
	for (const message of messages) {
		if (message.role !== 'user' && message.role !== 'assistant') continue;
		const text = (
			typeof message.content === 'string'
				? message.content
				: message.content
						.map((block) =>
							block.type === 'text' && typeof block.text === 'string' && block.internal !== true
								? block.text
								: ''
						)
						.filter(Boolean)
						.join('\n')
		).trim();
		if (message.role === 'user' && text === LEGACY_REALTIME_VOICE_PLACEHOLDER) continue;
		if (text) candidates.push({ role: message.role, text });
	}

	const selected: RealtimeVoiceHistoryMessage[] = [];
	let characters = 0;
	for (
		let index = candidates.length - 1;
		index >= 0 && selected.length < MAX_REALTIME_VOICE_HISTORY_MESSAGES;
		index -= 1
	) {
		const remaining = MAX_REALTIME_VOICE_HISTORY_CHARACTERS - characters;
		if (remaining <= 0) break;
		const candidate = candidates[index];
		const text = candidate.text.slice(-remaining);
		selected.push(text === candidate.text ? candidate : { ...candidate, text });
		characters += text.length;
	}
	return selected.reverse();
}
