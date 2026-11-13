import { MusicProviderAuthError, MusicProviderRequestError } from './tta_errors';
import { requestAudio } from './tta_shared';
import type { MusicAdapter, MusicProviderSpec } from './tta_types';

export function createFormMusicAdapter(spec: MusicProviderSpec): MusicAdapter {
	if (!spec.apiKey) throw new MusicProviderAuthError(`${spec.name} API key not configured.`);

	return {
		async generate(request) {
			if (!request.endpoint)
				throw new MusicProviderRequestError(`${spec.name}: the model declares no endpoint.`);
			const form = new FormData();
			form.set('prompt', request.prompt);
			form.set('output_format', 'mp3');
			for (const [key, value] of Object.entries(request.options ?? {})) {
				if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
					form.set(key, String(value));
				}
			}
			return requestAudio(spec.name, `${spec.baseURL}${request.endpoint}`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${spec.apiKey}`, Accept: 'audio/*' },
				body: form,
				signal: request.signal,
			});
		},
	};
}
