import { ensureSpeechResponseOk, responseAudioToBase64, speechResult } from './tts_audio';
import { SpeechProviderAuthError, SpeechProviderRequestError } from './tts_errors';
import type { SpeechAdapter, SpeechProviderSpec } from './tts_types';

export function createQwenSpeechAdapter(provider: SpeechProviderSpec): SpeechAdapter {
	if (!provider.apiKey) throw new SpeechProviderAuthError(`${provider.name} API key not configured.`);
	return { async synthesize(request) {
		const endpoint = new URL(provider.baseURL || 'https://dashscope.aliyuncs.com');
		endpoint.protocol = 'https:';
		endpoint.pathname = '/api/v1/services/audio/tts/SpeechSynthesizer';
		endpoint.search = '';
		const format = String(request.options?.format || 'mp3');
		const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: request.modelId, input: { ...request.options, text: request.text, voice: request.voice || request.options?.voice || (request.modelId.endsWith('plus') ? 'longanlingxin' : 'longanhuan_v3.6'), format } }) });
		await ensureSpeechResponseOk(response, provider.name);
		const result = await response.json() as { output?: { audio?: { url?: string } }; message?: string };
		if (!result.output?.audio?.url) throw new SpeechProviderRequestError(`${provider.name}: ${result.message || 'response contained no audio'}`);
		const audio = await fetch(result.output.audio.url);
		await ensureSpeechResponseOk(audio, provider.name);
		const mimeType = format === 'wav' ? 'audio/wav' : format === 'opus' ? 'audio/ogg' : format === 'pcm' ? 'audio/pcm' : 'audio/mpeg';
		return speechResult(await responseAudioToBase64(audio), mimeType, provider, request);
	} };
}
