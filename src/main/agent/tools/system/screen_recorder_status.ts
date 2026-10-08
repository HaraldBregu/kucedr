import { recordingOwner } from '../../recordings/owner';
import { z } from 'zod';
import { screen } from '../../../recorder';
import type { Tool } from '../../types';
import { tool } from '../tool';

export const screenRecorderStatusTool: Tool = tool({
	id: 'screen_recorder_status',
	category: 'system',
	name: 'Screen recorder status',
	description:
		'Check the status of a background screen recording started with screen_recorder. With wait=true it blocks until the recording finishes and returns the final result. The recorded file exists only once status is "completed".',
	inputSchema: z.object({
		id: z.string().min(1).describe('Recording id returned by screen_recorder.'),
		wait: z
			.boolean()
			.optional()
			.describe('Wait for the recording to finish before returning. Defaults to false.'),
	}),
	execute: async ({ id, wait }, signal) => {
		signal?.throwIfAborted();
		recordingOwner(screen, id);
		const recording = wait ? await screen.waitFor(id) : screen.get(id);
		if (!recording) throw new Error(`Unknown screen recording: ${id}`);
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
