import { z } from 'zod';
import { createImage } from '../../../models/image';
import type { Tool } from '../../types';
import { saveMedia } from './save';
import { tool } from '../tool';

export function createImageTool(): Tool {
	return tool({
		id: 'create_image',
		name: 'Create image',
		description:
			'Generate one to eight images from a text prompt using the configured text-to-image provider. Saves the images in your agent workspace directory and returns their absolute paths. The images are shown to the user automatically; if you reference one in markdown, use its returned path.',
		inputSchema: z.object({
			prompt: z.string().min(1).describe('Text prompt describing the image to generate.'),
			count: z
				.number()
				.int()
				.min(1)
				.max(8)
				.default(1)
				.describe('Number of images to generate, from 1 to 8. Defaults to 1.'),
			directory: z
				.string()
				.optional()
				.describe(
					'Optional directory to save the image in, relative to the agent workspace. ~ expands to the user home. Defaults to the agent workspace directory; only set it when the user asks for a specific location.'
				),
		}),
		execute: async ({ prompt, count, directory }, signal) => {
			const images: Array<{ path: string; mimeType: string }> = [];
			for (let index = 0; index < count; index++) {
				const { base64, mimeType } = await createImage({ prompt }, signal);
				const ext = mimeType.split('/')[1]?.split('+')[0] || 'png';
				const path = await saveMedia(
					count === 1 ? 'image' : `image-${index + 1}`,
					ext,
					base64,
					directory,
					signal
				);
				images.push({ path, mimeType });
			}
			return { path: images[0].path, mimeType: images[0].mimeType, images };
		},
	});
}
