import { ImageProviderAuthError, ImageProviderRequestError } from './tti_errors';
import { requestJson } from './tti_shared';
import type { ImageAdapter, ImageProviderSpec } from './tti_types';

type GenerateContentResponse = {
	candidates?: Array<{
		content?: {
			parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }>;
		};
	}>;
};

export function createContentImageAdapter(spec: ImageProviderSpec): ImageAdapter {
	if (!spec.apiKey) throw new ImageProviderAuthError(`${spec.name} API key not configured.`);
	const baseURL = spec.baseURL;

	return {
		async generate(request) {
			const data = await requestJson<GenerateContentResponse>(
				spec.name,
				`${baseURL}/models/${request.modelId}:generateContent`,
				{
					method: 'POST',
					headers: { 'x-goog-api-key': spec.apiKey, 'Content-Type': 'application/json' },
					body: JSON.stringify({
						contents: [
							{
								parts: [
									...(request.source
										? [
												{
													inlineData: {
														mimeType: request.source.mimeType,
														data: request.source.base64,
													},
												},
											]
										: []),
									{ text: request.prompt },
								],
							},
						],
						generationConfig: {
							responseModalities: ['TEXT', 'IMAGE'],
							...(request.options ? { imageConfig: request.options } : {}),
						},
					}),
					signal: request.signal,
				}
			);
			const inlineData = data.candidates?.[0]?.content?.parts?.find(
				(part) => part.inlineData?.data
			)?.inlineData;
			if (!inlineData?.data) {
				throw new ImageProviderRequestError(`${spec.name}: response contained no image.`);
			}
			return { base64: inlineData.data, mimeType: inlineData.mimeType ?? 'image/png' };
		},
	};
}
