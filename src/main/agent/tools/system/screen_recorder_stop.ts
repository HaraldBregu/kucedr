import { recordingOwner } from '../../recordings/owner';
import { z } from 'zod';
import { screen } from '../../../recorder';
import type { Tool } from '../../types';
import { tool } from '../tool';

export const screenRecorderStopTool: Tool = tool({
	id: 'screen_recorder_stop',
	category: 'system',
	name: 'Screen recorder stop',
	description: 'Stop an active screen recording and begin saving its captured data.',
	inputSchema: z.object({ id: z.string().uuid() }),
	execute: ({ id }) => {
		recordingOwner(screen, id);
		const recording = screen.get(id);
		if (!recording) throw new Error(`Unknown screen recording: ${id}`);
		screen.stop(id);
		return { id, path: recording.url, status: screen.get(id)?.status };
	},
});
