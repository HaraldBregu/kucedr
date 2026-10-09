import type { RealtimeVoiceProviderSpec } from './realtime_voice_types';

export function realtimeVoiceTransportError(error: Error, provider: RealtimeVoiceProviderSpec, modelId: string): Error {
	if (/Unexpected server response: 401\b/.test(error.message)) {
		return new Error(`${provider.name} rejected the API key for ${modelId} (HTTP 401). Update the API key in provider settings.`, { cause: error });
	}
	if (/Unexpected server response: 403\b/.test(error.message)) {
		return new Error(`${provider.name} denied access to ${modelId} (HTTP 403). Check the API key permissions and model access.`, { cause: error });
	}
	return error;
}
