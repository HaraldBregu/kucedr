import { recordingOwner } from '../../recordings/owner';
import { z } from 'zod';
import { camera } from '../../../recorder';
import type { Tool } from '../../types';
import { tool } from '../tool';

export const cameraRecorderStatusTool: Tool = tool({
	id: 'camera_recorder_status',
	category: 'system',
	name: 'Camera recorder status',
	description:
		'Check the status of a background camera recording started with camera_recorder. With wait=true it blocks until the recording finishes and returns the final result. The recorded file exists only once status is "completed".',
	inputSchema: z.object({
		id: z.string().min(1).describe('Recording id returned by camera_recorder.'),
		wait: z
			.boolean()
			.optional()
			.describe('Wait for the recording to finish before returning. Defaults to false.'),
	}),
	execute: async ({ id, wait }, signal) => {
		signal?.throwIfAborted();
		recordingOwner(camera, id);
		const recording = wait ? await camera.waitFor(id) : camera.get(id);
		if (!recording) throw new Error(`Unknown camera recording: ${id}`);
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
