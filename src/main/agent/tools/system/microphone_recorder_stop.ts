import { recordingOwner } from '../../recordings/owner';
import { z } from 'zod';
import { microphone } from '../../../recorder';
import type { Tool } from '../../types';
import { tool } from '../tool';

export const microphoneRecorderStopTool: Tool = tool({
	id: 'microphone_recorder_stop',
	category: 'system',
	name: 'Microphone recorder stop',
	description: 'Stop an active microphone recording and begin saving its captured data.',
	inputSchema: z.object({ id: z.string().uuid() }),
	execute: ({ id }) => {
		recordingOwner(microphone, id);
		const recording = microphone.get(id);
		if (!recording) throw new Error(`Unknown microphone recording: ${id}`);
		microphone.stop(id);
		return { id, path: recording.url, status: microphone.get(id)?.status };
	},
});
