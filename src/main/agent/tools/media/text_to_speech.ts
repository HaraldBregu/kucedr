import { z } from 'zod';
import { getToolModel } from '../../agent_store';
import type { Tool } from '../../types';
import { saveMedia } from './save';
import { tool } from '../tool';

export function textToSpeechTool(): Tool {
	return tool({
		id: 'text_to_speech',
		name: 'Text to speech',
		description:
			'Generate spoken audio from text using the configured tool text-to-speech provider. Saves the audio in your agent workspace directory and returns its absolute path.',
		inputSchema: z.object({
			text: z.string().min(1).describe('Text to synthesize as spoken audio.'),
			directory: z
				.string()
				.optional()
				.describe('Optional directory to save the audio in, relative to the agent workspace.'),
		}),
		execute: async ({ text, directory }, signal) => {
			const settings = getToolModel('textToSpeech');
			if (!settings.providerId || !settings.modelId) {
				throw new Error('Configure a Text to speech tool model in Settings.');
			}
			const { synthesize } = await import('../../../models/voice');
			const { audio, mimeType } = await synthesize(
				{
					text,
					providerId: settings.providerId,
					modelId: settings.modelId,
					options: settings.options,
				},
				'tool'
			);
			const extension = mimeType.includes('mpeg') ? 'mp3' : mimeType.split('/')[1] ?? 'mp3';
			const path = await saveMedia('speech', extension, audio, directory, signal);
			return { path, mimeType };
		},
	});
}
