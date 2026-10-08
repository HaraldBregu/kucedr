import { recordingOwner } from '../../recordings/owner';
import { z } from 'zod';
import { microphone } from '../../../recorder';
import type { Tool } from '../../types';
import { tool } from '../tool';

export const microphoneRecorderStatusTool: Tool = tool({
	id: 'microphone_recorder_status',
	category: 'system',
	name: 'Microphone recorder status',
	description:
		'Check the status of a background microphone recording started with microphone_recorder. With wait=true it blocks until the recording finishes and returns the final result. The recorded file exists only once status is "completed".',
	inputSchema: z.object({
		id: z.string().min(1).describe('Recording id returned by microphone_recorder.'),
		wait: z
			.boolean()
			.optional()
			.describe('Wait for the recording to finish before returning. Defaults to false.'),
	}),
	execute: async ({ id, wait }, signal) => {
		signal?.throwIfAborted();
		recordingOwner(microphone, id);
		const recording = wait ? await microphone.waitFor(id) : microphone.get(id);
		if (!recording) throw new Error(`Unknown microphone recording: ${id}`);
		return {
			id: recording.id,
			path: recording.url,
			status: recording.status,
			durationMs: recording.duration,
			mimeType: recording.mimeType,
			size: recording.size,
			error: recording.error,
		};
	},
});
