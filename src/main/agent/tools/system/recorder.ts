import { recordingOwner } from '../../recordings/owner';
import { rememberRecording } from '../../recordings/remember';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { camera, microphone, screen } from '../../../recorder';
import { mediaDirectory } from '../../../shared/media_directory';
import type { Tool } from '../../types';
import { tool } from '../tool';
import { captureSource } from './capture';

type Kind = 'camera' | 'microphone' | 'screen';

type StartInput = {
	target?: 'full_screen' | 'workspace' | 'application';
	sourceId?: string;
	duration?: number;
	directory?: string;
	filename?: string;
};

const recorders = { camera, microphone, screen };

const MAX_WAIT_MS = 9 * 60_000;

const labels = { camera: 'Camera', microphone: 'Microphone', screen: 'Screen' };

const captures = {
	camera: 'video (with audio) from the user camera',
	microphone: 'audio from the user microphone',
};

const SCREEN_DESCRIPTION =
	'Start recording the user screen (video only). When the user directly requests the full screen, workspace, or application, set target to start it immediately without selecting a source. Otherwise call without sourceId or target; if it returns selection_required, call select_screen_source with the returned sources, then call this tool again with the returned sourceId. Requires an open app window and macOS Screen Recording permission. The recording runs in the background: this returns immediately with a recording id and the destination path. Specify a duration to stop automatically, or omit it and use screen_recorder_stop.';

const DURATION_DESCRIPTION =
	'Optional recording duration in seconds (max 600). Omit to record until stopped.';

const DIRECTORY_DESCRIPTION =
	'Optional directory to save the recording in, relative to the agent workspace. Absolute paths are supported and ~ expands to the user home. Defaults to ~/.kucedr/library; only set it when the user asks for a specific location.';

const screenFields = {
	target: z
		.enum(['full_screen', 'workspace', 'application'])
		.optional()
		.describe(
			'Capture target explicitly requested by the user. Use full_screen for the entire display, workspace for the Kucedr workspace, or application for the Kucedr application. This starts recording immediately without asking the user to select a source.'
		),
	sourceId: z
		.string()
		.trim()
		.min(1)
		.max(256)
		.optional()
		.describe('Source identifier returned by select_screen_source.'),
};

export function recorderTools(kind: Kind): { start: Tool; status: Tool; stop: Tool } {
	const recorder = recorders[kind];
	const fields = {
		duration: z.number().min(1).max(600).optional().describe(DURATION_DESCRIPTION),
		directory: z.string().optional().describe(DIRECTORY_DESCRIPTION),
		filename: z
			.string()
			.optional()
			.describe(
				`Optional file name for the recording, including the .webm extension (recordings are always WebM). Any directory part is ignored; use directory instead. Defaults to ${kind}-<timestamp>.webm.`
			),
	};
	const inputSchema: z.ZodType<StartInput> =
		kind === 'screen' ? z.object({ ...screenFields, ...fields }) : z.object(fields);
	const start = tool({
		id: `${kind}_recorder`,
		category: 'system',
		name: `${labels[kind]} recorder`,
		description:
			kind === 'screen'
				? SCREEN_DESCRIPTION
				: `Start recording ${captures[kind]}. Requires an open app window. The recording runs in the background: this returns immediately with a recording id and the destination path, and the file is written when the recording finishes. Specify a duration to stop automatically, or omit it and use ${kind}_recorder_stop. Use ${kind}_recorder_status to check progress or wait for completion before using the file.`,
		inputSchema,
		execute: async ({ target, sourceId, duration, directory, filename }, signal) => {
			signal?.throwIfAborted();
			const source = kind === 'screen' ? await captureSource(target, sourceId) : undefined;
			if (typeof source === 'object') return source;
			const owner = recordingOwner(recorder);
			const targetDir = mediaDirectory(directory);
			const url = path.join(targetDir, path.basename(filename ?? `${kind}-${Date.now()}.webm`));
			if (fs.existsSync(url)) throw new Error(`Recording file already exists: ${url}`);
			const recording = recorder.start({
				url,
				...(source === undefined ? {} : { sourceId: source }),
				...(duration === undefined ? {} : { duration: duration * 1000 }),
			});
			rememberRecording(recorder, recording.id, owner);
			signal?.addEventListener('abort', () => recorder.cancel(recording.id), { once: true });
			return {
				id: recording.id,
				path: recording.url,
				status: recording.status,
				durationMs: recording.duration,
			};
		},
	});
	const status = tool({
		id: `${kind}_recorder_status`,
		category: 'system',
		name: `${labels[kind]} recorder status`,
		description: `Check the status of a background ${kind} recording started with ${kind}_recorder. With wait=true it blocks until the recording finishes and returns the final result. The recorded file exists only once status is "completed".`,
		inputSchema: z.object({
			id: z.string().min(1).describe(`Recording id returned by ${kind}_recorder.`),
			wait: z
				.boolean()
				.optional()
				.describe('Wait for the recording to finish before returning. Defaults to false.'),
		}),
		execute: async ({ id, wait }, signal) => {
			signal?.throwIfAborted();
			recordingOwner(recorder, id);
			const recording = wait ? await recorder.waitFor(id) : recorder.get(id);
			if (!recording) throw new Error(`Unknown ${kind} recording: ${id}`);
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
	const stop = tool({
		id: `${kind}_recorder_stop`,
		category: 'system',
		name: `${labels[kind]} recorder stop`,
		description: `Stop an active ${kind} recording and begin saving its captured data.`,
		inputSchema: z.object({ id: z.string().uuid() }),
		execute: ({ id }) => {
			recordingOwner(recorder, id);
			const recording = recorder.get(id);
			if (!recording) throw new Error(`Unknown ${kind} recording: ${id}`);
			recorder.stop(id);
			return { id, path: recording.url, status: recorder.get(id)?.status };
		},
	});
	return { start, status, stop };
}
