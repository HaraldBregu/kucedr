import { z } from 'zod';
import { createImage } from '../../../models/image';
import type { Tool } from '../../types';
import { saveMedia } from '../../../shared/media';
import { tool } from '../tool';
import { modelOptions } from './options';
import { inlineFiles } from './inline';

export function createImageTool(): Tool {
	const { model, shape } = modelOptions('image', 'text-to-image');
	return tool({
		id: 'create_image',
		category: 'media',
		name: 'Create image',
		description: `Generate one to eight images from a text prompt using the configured text-to-image provider${model ? ` (${model})` : ''}. Saves the images in ~/.kucedr/library by default and returns their absolute paths. The images are shown to the user automatically; if you reference one in markdown, use its returned path. Only set model options when the user asks for them; omitted options use the configured settings.`,
		inputSchema: z.object({
			prompt: z.string().min(1).describe('Text prompt describing the image to generate.'),
			...shape,
			count: z
				.number()
				.int()
				.min(1)
				.max(3)
				.default(1)
				.describe('Number of images to generate, from 1 to 3. Defaults to 1.'),
			directory: z
				.string()
				.optional()
				.describe(
					'Optional directory to save the image in, relative to the agent workspace. Absolute paths are supported and ~ expands to the user home. Defaults to ~/.kucedr/library; only set it when the user asks for a specific location.'
				),
		}),
		execute: async ({ prompt, count, directory, ...options }, signal) => {
			const images: Array<{ path: string; mimeType: string }> = [];
			const inlined = (await inlineFiles(options)) as Record<string, unknown>;
			for (let index = 0; index < count; index++) {
				try {
					const { base64, mimeType } = await createImage({ prompt, options: inlined }, signal);
					const ext = mimeType.split('/')[1]?.split('+')[0] || 'png';
					const path = await saveMedia(
						count === 1 ? 'image' : `image-${index + 1}`,
						ext,
						base64,
						directory,
						signal
					);
					images.push({ path, mimeType });
				} catch (error) {
					if (images.length === 0) throw error;
					return {
						path: images[0].path,
						mimeType: images[0].mimeType,
						images,
						error: `Generated ${images.length} of ${count} images: ${error instanceof Error ? error.message : String(error)}`,
					};
				}
			}
			return { path: images[0].path, mimeType: images[0].mimeType, images };
		},
	});
}
