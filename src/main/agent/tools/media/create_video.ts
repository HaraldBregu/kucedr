import { z } from 'zod';
import { createVideo } from '../../../models/video';
import type { Tool } from '../../types';
import { saveMedia } from '../../../shared/media';
import { tool } from '../tool';

export function createVideoTool(): Tool {
	return tool({
		id: 'create_video',
		category: 'media',
		name: 'Create video',
		description:
			'Generate a video from a text prompt using the configured text-to-video provider. Saves the video in ~/.kucedr/library by default and returns its absolute path. Video generation can take several minutes; if you reference it in markdown, use the returned path.',
		inputSchema: z.object({
			prompt: z.string().min(1).describe('Text prompt describing the video to generate.'),
			directory: z
				.string()
				.optional()
				.describe(
					'Optional directory to save the video in, relative to the agent workspace. Absolute paths are supported and ~ expands to the user home. Defaults to ~/.kucedr/library; only set it when the user asks for a specific location.'
				),
		}),
		execute: async ({ prompt, directory }, signal) => {
			const { base64, mimeType } = await createVideo({ prompt }, signal);
			const ext = mimeType.split('/')[1]?.split('+')[0] || 'mp4';
			const filePath = await saveMedia('video', ext, base64, directory, signal);
			return { path: filePath, mimeType };
		},
	});
}
