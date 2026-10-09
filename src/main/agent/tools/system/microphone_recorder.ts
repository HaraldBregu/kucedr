import { recordingOwner } from '../../recordings/owner';
import { rememberRecording } from '../../recordings/remember';
import path from 'node:path';
import { z } from 'zod';
import { microphone } from '../../../recorder';
import { mediaDirectory } from '../../../shared/media_directory';
import type { Tool } from '../../types';
import { tool } from '../tool';

export function microphoneRecorderTool(): Tool {
	return tool({
		id: 'microphone_recorder',
		category: 'system',
		name: 'Microphone recorder',
		description:
			'Start recording audio from the user microphone. Requires an open app window. The recording runs in the background: this returns immediately with a recording id and the destination path, and the file is written when the recording finishes. Specify a duration to stop automatically, or omit it and use microphone_recorder_stop. Use microphone_recorder_status to check progress or wait for completion before using the file.',
		inputSchema: z.object({
			duration: z
				.number()
				.min(1)
				.max(600)
				.optional()
				.describe(
					'Optional recording duration in seconds (max 600). Omit to record until stopped.'
				),
			directory: z
				.string()
				.optional()
				.describe(
					'Optional directory to save the recording in, relative to the agent workspace. Absolute paths are supported and ~ expands to the user home. Defaults to ~/.kucedr/library; only set it when the user asks for a specific location.'
				),
			filename: z
				.string()
				.optional()
				.describe(
					'Optional file name for the recording, including the .webm extension (recordings are always WebM). Any directory part is ignored; use directory instead. Defaults to microphone-<timestamp>.webm.'
				),
		}),
		execute: async ({ duration, directory, filename }, signal) => {
			signal?.throwIfAborted();
			const owner = recordingOwner(microphone);
			const targetDir = mediaDirectory(directory);
			const url = path.join(targetDir, path.basename(filename ?? `microphone-${Date.now()}.webm`));
			const recording = microphone.start({
				url,
				...(duration === undefined ? {} : { duration: duration * 1000 }),
			});
			rememberRecording(microphone, recording.id, owner);
			signal?.addEventListener('abort', () => microphone.cancel(recording.id), { once: true });
			return {
				id: recording.id,
				path: recording.url,
				status: recording.status,
				durationMs: recording.duration,
			};
		},
	});
}
