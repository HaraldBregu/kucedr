import { ImageProviderAuthError, ImageProviderRequestError } from './tti_errors';
import { detectMimeType, requestJson } from './tti_shared';
import type { ImageAdapter, ImageProviderSpec } from './tti_types';

type FormResponse = { image?: string };

export function createFormImageAdapter(spec: ImageProviderSpec): ImageAdapter {
	if (!spec.apiKey) throw new ImageProviderAuthError(`${spec.name} API key not configured.`);
	const baseURL = spec.baseURL;

	return {
		async generate(request) {
			const form = new FormData();
			form.set('prompt', request.prompt);
			for (const [key, value] of Object.entries(request.options ?? {})) {
				if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
					form.set(key, String(value));
				}
			}
			const response = await requestJson<FormResponse>(
				spec.name,
				`${baseURL}/${request.endpoint ?? request.modelId}`,
				{
					method: 'POST',
					headers: { Authorization: `Bearer ${spec.apiKey}`, Accept: 'application/json' },
					body: form,
					signal: request.signal,
				}
			);
			if (!response.image) {
				throw new ImageProviderRequestError(`${spec.name}: response contained no image.`);
			}
			return { base64: response.image, mimeType: detectMimeType(response.image) };
		},
	};
}
