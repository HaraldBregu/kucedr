import type { RealtimeVoiceModelSpec } from './realtime_voice_types';

export function realtimeVoiceName(voice: string, model: RealtimeVoiceModelSpec): string {
	const fallback = model.metadata?.inputs.voice?.default;
	return voice.trim() || (typeof fallback === 'string' ? fallback : '');
}
