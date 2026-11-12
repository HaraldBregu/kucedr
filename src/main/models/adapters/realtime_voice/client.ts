import OpenAI from 'openai';
import { OpenAIRealtimeWS } from 'openai/realtime/ws';
import type {
	RealtimeVoiceModelSpec,
	RealtimeVoiceProviderSpec,
	RealtimeVoiceSocket,
} from './realtime_voice_types';

export function createRealtimeSocket(
	provider: RealtimeVoiceProviderSpec,
	model: RealtimeVoiceModelSpec
): RealtimeVoiceSocket {
	const client = new OpenAI({
		apiKey: provider.apiKey,
		baseURL: model.url,
	});
	return new OpenAIRealtimeWS({ model: model.id }, client) as unknown as RealtimeVoiceSocket;
}
