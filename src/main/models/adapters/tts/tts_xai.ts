import { ensureSpeechResponseOk, responseAudioToBase64, speechResult } from './tts_audio';
import type { SpeechAdapter, SpeechProviderSpec } from './tts_types';

export function createXaiSpeechAdapter(provider: SpeechProviderSpec): SpeechAdapter {
	return {
		async synthesize(request) {
			const options = request.options ?? {};
			const response = await fetch(new URL('tts', `${provider.baseURL}/`), {
				method: 'POST',
				headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...options,
					text: request.text,
					voice_id: request.voice ?? options.voice_id ?? 'eve',
					language: options.language ?? 'auto',
					with_timestamps: false,
				}),
			});
			await ensureSpeechResponseOk(response, provider.name);
			return speechResult(
				await responseAudioToBase64(response),
				response.headers.get('content-type')?.split(';')[0] ?? 'audio/mpeg',
				provider,
				request
			);
		},
	};
}
