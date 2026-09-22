import { z } from 'zod';
import { createSound } from '../../../models/sound';
import type { Tool } from '../../types';
import { saveMedia } from './save';
import { tool } from '../tool';

export function createSoundTool(): Tool {
	return tool({
		id: 'create_sound',
		name: 'Create sound',
		description:
			'Generate music or a sound effect from a text prompt using the configured text-to-audio provider. Saves the audio in your agent workspace directory and returns its absolute path. If you reference it in markdown, use the returned path.',
		inputSchema: z.object({
			prompt: z.string().min(1).describe('Text prompt describing the music or sound to generate.'),
			directory: z
				.string()
				.optional()
				.describe(
					'Optional directory to save the audio in, relative to the agent workspace. ~ expands to the user home. Defaults to the agent workspace directory; only set it when the user asks for a specific location.'
				),
		}),
		execute: async ({ prompt, directory }, signal) => {
			const { base64, mimeType } = await createSound({ prompt }, signal);
			const ext = mimeType.includes('mpeg') ? 'mp3' : mimeType.split('/')[1]?.split('+')[0] || 'mp3';
			const filePath = await saveMedia('sound', ext, base64, directory, signal);
			return { path: filePath, mimeType };
		},
	});
}
