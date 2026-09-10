import { recordingOwner } from '../../recordings/owner';
import { rememberRecording } from '../../recordings/remember';
import { desktopCapturer } from 'electron';
import path from 'node:path';
import { z } from 'zod';
import { screen } from '../../../recorder';
import { agentLocation } from '../../../shared/agent_location';
import { resolveUserPath } from '../../../shared/user_path';
import type { Tool } from '../../types';
import { tool } from '../tool';

export function screenRecorderTool(): Tool {
	return tool({
		id: 'screen_recorder',
		name: 'Screen recorder',
		description:
			'Start recording the user screen (video only). Call without sourceId first. If it returns selection_required, call select_screen_source with the returned sources, then call this tool again with the returned sourceId. Requires an open app window and macOS Screen Recording permission. The recording runs in the background: this returns immediately with a recording id and the destination path. Specify a duration to stop automatically, or omit it and use screen_recorder_stop.',
		inputSchema: z.object({
			sourceId: z
				.string()
				.trim()
				.min(1)
				.max(256)
				.optional()
				.describe('Source identifier returned by select_screen_source.'),
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
					'Optional directory to save the recording in, relative to the agent workspace. ~ expands to the user home. Defaults to the agent workspace directory; only set it when the user asks for a specific location.'
				),
			filename: z
				.string()
				.optional()
				.describe(
					'Optional file name for the recording, including the .webm extension (recordings are always WebM). Any directory part is ignored; use directory instead. Defaults to screen-<timestamp>.webm.'
				),
		}),
		execute: async ({ sourceId, duration, directory, filename }, signal) => {
			signal?.throwIfAborted();
			const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
			if (!sourceId) {
				return {
					status: 'selection_required' as const,
					sources: sources.map((source) => ({
						id: source.id,
						name: source.name || 'Untitled source',
						type: source.id.startsWith('screen:') ? ('screen' as const) : ('window' as const),
					})),
				};
			}
			if (!sources.some((source) => source.id === sourceId)) {
				throw new Error('The selected screen source is no longer available. Start again to choose a source.');
			}
			const owner = recordingOwner(screen);
			const targetDir = resolveUserPath(directory ?? '.', agentLocation());
			const url = path.join(targetDir, path.basename(filename ?? `screen-${Date.now()}.webm`));
			const recording = screen.start({
				url,
				sourceId,
				...(duration === undefined ? {} : { duration: duration * 1000 }),
			});
			rememberRecording(screen, recording.id, owner);
			signal?.addEventListener('abort', () => screen.cancel(recording.id), { once: true });
			return {
				id: recording.id,
				path: recording.url,
				status: recording.status,
				durationMs: recording.duration,
			};
		},
	});
}
