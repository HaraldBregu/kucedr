import { recordingOwner } from '../../recordings/owner';
import { z } from 'zod';
import { camera } from '../../../recorder';
import type { Tool } from '../../types';
import { tool } from '../tool';

export const cameraRecorderStopTool: Tool = tool({
	id: 'camera_recorder_stop',
	category: 'system',
	name: 'Camera recorder stop',
	description: 'Stop an active camera recording and begin saving its captured data.',
	inputSchema: z.object({ id: z.string().uuid() }),
	execute: ({ id }) => {
		recordingOwner(camera, id);
		const recording = camera.get(id);
		if (!recording) throw new Error(`Unknown camera recording: ${id}`);
		camera.stop(id);
		return { id, path: recording.url, status: camera.get(id)?.status };
	},
});
