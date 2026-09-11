import path from 'node:path';
import { z } from 'zod';
import { STT_MAX_AUDIO_BASE64_LENGTH } from '../../../../shared/stt_transcription';
import { workspaceFileType } from '../../../../shared/workspace';
import { getToolModel } from '../../agent_store';
import { authorizeFilePath } from '../../files/authorize';
import { readFileBounded } from '../../files/read';
import { transcribe } from '../../../models/transcribe';
import type { Tool } from '../../types';
import { tool } from '../tool';

const MAX_AUDIO_BYTES = Math.floor((STT_MAX_AUDIO_BASE64_LENGTH / 4) * 3);

export function speechToTextTool(): Tool {
	return tool({
		id: 'speech_to_text',
		name: 'Speech to text',
		description:
			'Transcribe an approved audio file using the configured tool speech-to-text provider and return its text.',
		inputSchema: z.object({
			path: z.string().min(1).describe('Absolute path to the approved audio file to transcribe.'),
			language: z.string().min(1).optional().describe('Optional BCP-47 language hint.'),
			prompt: z.string().min(1).optional().describe('Optional transcription vocabulary hint.'),
		}),
		execute: async ({ path: filePath, language, prompt }, signal) => {
			const settings = getToolModel('speechToText');
			if (!settings.providerId || !settings.modelId) {
				throw new Error('Configure a Speech to text tool model in Settings.');
			}
			const resolved = authorizeFilePath(filePath);
			const { kind, mimeType } = workspaceFileType(resolved);
			if (kind !== 'audio' || !mimeType) throw new Error('Speech to text requires an audio file.');
			const audio = await readFileBounded(resolved, MAX_AUDIO_BYTES, signal);
			const result = await transcribe({
				audio: {
					data: audio.toString('base64'),
					encoding: 'base64',
					mimeType,
					fileName: path.basename(resolved),
					byteLength: audio.length,
				},
				providerId: settings.providerId,
				modelId: settings.modelId,
				...(language ? { language } : {}),
				...(prompt ? { prompt } : {}),
			});
			return result;
		},
	});
}
