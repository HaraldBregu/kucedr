import { z } from 'zod';
import { createVideo } from '../../../models/video';
import type { Tool } from '../../types';
import { saveMedia } from '../../../shared/media';
import { tool } from '../tool';
import { modelOptions } from './options';
import { inlineFiles } from './inline';

export function createVideoTool(): Tool {
	const { model, shape } = modelOptions('video', 'text-to-video');
	return tool({
		id: 'create_video',
		category: 'media',
		name: 'Create video',
		description: `Generate a video from a text prompt using the configured text-to-video provider${model ? ` (${model})` : ''}. Saves the video in ~/.kucedr/library by default and returns its absolute path. Video generation can take several minutes; if you reference it in markdown, use the returned path. Only set model options when the user asks for them; omitted options use the configured settings.`,
		inputSchema: z.object({
			prompt: z.string().min(1).describe('Text prompt describing the video to generate.'),
			...shape,
			directory: z
				.string()
				.optional()
				.describe(
					'Optional directory to save the video in, relative to the agent workspace. Absolute paths are supported and ~ expands to the user home. Defaults to ~/.kucedr/library; only set it when the user asks for a specific location.'
				),
		}),
		execute: async ({ prompt, directory, ...options }, signal) => {
			const { base64, mimeType } = await createVideo(
				{ prompt, options: (await inlineFiles(options)) as Record<string, unknown> },
				signal
			);
			const ext = mimeType.split('/')[1]?.split('+')[0] || 'mp4';
			const filePath = await saveMedia('video', ext, base64, directory, signal);
			return { path: filePath, mimeType };
		},
	});
}
