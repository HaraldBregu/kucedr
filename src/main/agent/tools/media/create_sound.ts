import { z } from 'zod';
import { createSound } from '../../../models/sound';
import type { Tool } from '../../types';
import { saveMedia } from '../../../shared/media';
import { tool } from '../tool';
import { modelOptions } from './options';

export function createSoundTool(): Tool {
	const { model, shape } = modelOptions('sound', 'text-to-audio');
	return tool({
		id: 'create_sound',
		category: 'media',
		name: 'Create sound',
		description: `Generate music or a sound effect from a text prompt using the configured text-to-audio provider${model ? ` (${model})` : ''}. Saves the audio in ~/.kucedr/library by default and returns its absolute path. If you reference it in markdown, use the returned path. Only set model options when the user asks for them; omitted options use the configured settings.`,
		inputSchema: z.object({
			prompt: z.string().min(1).describe('Text prompt describing the music or sound to generate.'),
			...shape,
			directory: z
				.string()
				.optional()
				.describe(
					'Optional directory to save the audio in, relative to the agent workspace. Absolute paths are supported and ~ expands to the user home. Defaults to ~/.kucedr/library; only set it when the user asks for a specific location.'
				),
		}),
		execute: async ({ prompt, directory, ...options }, signal) => {
			const { base64, mimeType } = await createSound(
				{ prompt, options: (await inlineFiles(options)) as Record<string, unknown> },
				signal
			);
			const ext = mimeType.includes('mpeg')
				? 'mp3'
				: mimeType.split('/')[1]?.split('+')[0] || 'mp3';
			const filePath = await saveMedia('sound', ext, base64, directory, signal);
			return { path: filePath, mimeType };
		},
	});
}
