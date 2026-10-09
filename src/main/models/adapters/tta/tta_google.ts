import { requestGoogleInteraction } from '../google/interaction';
import { MusicProviderAuthError, MusicProviderRequestError } from './tta_errors';
import type { MusicAdapter, MusicProviderSpec } from './tta_types';

export function createGoogleMusicAdapter(spec: MusicProviderSpec): MusicAdapter {
	if (!spec.apiKey) throw new MusicProviderAuthError(`${spec.name} API key not configured.`);
	return {
		async generate(request) {
			const { images, ...options } = request.options ?? {};
			const content = await requestGoogleInteraction(
				spec,
				{
					...options,
					model: request.modelId,
					input: Array.isArray(images)
						? [{ type: 'text', text: request.prompt }, ...images]
						: request.prompt,
				},
				{ auth: MusicProviderAuthError, request: MusicProviderRequestError },
				request.signal
			);
			const audio = content.filter((part) => part.type === 'audio' && part.data).at(-1);
			if (!audio?.data)
				throw new MusicProviderRequestError(`${spec.name}: response contained no audio.`);
			return { base64: audio.data, mimeType: audio.mime_type ?? 'audio/mpeg' };
		},
	};
}
