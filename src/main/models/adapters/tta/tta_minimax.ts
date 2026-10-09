import { MusicProviderAuthError, MusicProviderRequestError } from './tta_errors';
import { requestAudio } from './tta_shared';
import type { MusicAdapter, MusicProviderSpec } from './tta_types';

type MiniMaxMusic = { data?: { audio?: string }; base_resp?: { status_code?: number; status_msg?: string } };

export function createMiniMaxMusicAdapter(spec: MusicProviderSpec): MusicAdapter {
	if (!spec.apiKey) throw new MusicProviderAuthError(`${spec.name} API key not configured.`);
	const baseURL = spec.baseURL ?? 'https://api.minimax.io/v1';
	return {
		async generate(request) {
			const { stream: _stream, output_format, reference_audio, ...options } = request.options ?? {};
			const response = await fetch(`${baseURL}/music_generation`, {
				method: 'POST', signal: request.signal,
				headers: { Authorization: `Bearer ${spec.apiKey}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...options, model: request.modelId, prompt: request.prompt, stream: false, output_format: output_format ?? 'hex', ...(reference_audio ? { audio_url: reference_audio } : {}) }),
			});
			if (response.status === 401 || response.status === 403) throw new MusicProviderAuthError(`${spec.name}: authentication failed.`);
			if (!response.ok) throw new MusicProviderRequestError(`${spec.name} request failed (${response.status}): ${await response.text()}`);
			const data = await response.json() as MiniMaxMusic;
			if (data.base_resp?.status_code || !data.data?.audio) throw new MusicProviderRequestError(`${spec.name}: ${data.base_resp?.status_msg ?? 'response contained no audio'}`);
			if (output_format === 'url') return requestAudio(spec.name, data.data.audio, { signal: request.signal });
			const setting = options.audio_setting as { format?: string } | undefined;
			return { base64: Buffer.from(data.data.audio, 'hex').toString('base64'), mimeType: setting?.format === 'wav' ? 'audio/wav' : 'audio/mpeg' };
		},
	};
}
