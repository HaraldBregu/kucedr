import {
	ImageProviderAuthError,
	ImageProviderRequestError,
	ImageProviderUnsupportedError,
} from './tti_errors';
import { fetchImageAsBase64, requestJson } from './tti_shared';
import type { ImageAdapter, ImageProviderSpec } from './tti_types';

const QWEN_BASE_URL = 'https://dashscope-intl.aliyuncs.com/api/v1';

type QwenResponse = {
	output?: {
		choices?: Array<{ message?: { content?: Array<{ image?: string }> } }>;
	};
};

export function createQwenImageAdapter(spec: ImageProviderSpec): ImageAdapter {
	if (!spec.apiKey) throw new ImageProviderAuthError(`${spec.name} API key not configured.`);
	const baseURL = spec.baseURL ?? QWEN_BASE_URL;

	return {
		supportsSource: true,
		async generate(request) {
			if (
				request.source &&
				!request.modelId.includes('image-edit') &&
				!/^qwen-image-[23]\.[01]/.test(request.modelId) &&
				!request.modelId.startsWith('wan2.7-image')
			) {
				throw new ImageProviderUnsupportedError(
					`${request.modelId} does not support source-image editing.`
				);
			}
			const { image: images, ...parameters } = request.options ?? {};
			const references = Array.isArray(images)
				? images
				: typeof images === 'string'
					? [images]
					: [];
			const response = await requestJson<QwenResponse>(
				spec.name,
				`${baseURL}/services/aigc/multimodal-generation/generation`,
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${spec.apiKey}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						model: request.modelId,
						input: {
							messages: [
								{
									role: 'user',
									content: [
										...(request.source
											? [
													{
														image: `data:${request.source.mimeType};base64,${request.source.base64}`,
													},
												]
											: []),
										...references.map((image) => ({ image })),
										{ text: request.prompt },
									],
								},
							],
						},
						parameters,
					}),
					signal: request.signal,
				}
			);
			const image = response.output?.choices?.[0]?.message?.content?.find(
				(part) => part.image
			)?.image;
			if (!image) throw new ImageProviderRequestError(`${spec.name}: response contained no image.`);
			return fetchImageAsBase64(image, request.signal);
		},
	};
}
