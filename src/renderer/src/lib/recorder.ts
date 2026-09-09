import { getMicrophoneConstraints } from '@/lib/microphone/constraints';
import type { RecorderApi } from '@shared/api_types';

type RecorderTrack = RecorderApi['microphone'];

type ActiveCapture = {
	recorder: MediaRecorder | null;
	stream: MediaStream | null;
	timer: number;
	discard: boolean;
	stopRequested: boolean;
	sequence: number;
	pendingChunks: number;
	writeChain: Promise<void>;
	error: string | null;
	removeEndedListener: (() => void) | null;
};

const CHUNK_TIMESLICE_MS = 1_000;
const MAX_PENDING_CHUNKS = 8;
const VIDEO_MIME_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
const AUDIO_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm'];

function supportedMimeType(types: readonly string[]): string | undefined {
	if (typeof MediaRecorder === 'undefined') return undefined;
	return types.find((type) => {
		try {
			return MediaRecorder.isTypeSupported(type);
		} catch {
			return false;
		}
	});
}

function captureError(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}

function createCaptureHost(
	api: RecorderTrack,
	getStream: () => Promise<MediaStream>,
	mediaKind: 'audio' | 'video'
): () => void {
	const captures = new Map<string, ActiveCapture>();

	function stopStream(capture: ActiveCapture): void {
		capture.removeEndedListener?.();
		capture.removeEndedListener = null;
		capture.stream?.getTracks().forEach((track) => track.stop());
		capture.stream = null;
	}

	function stopCapture(id: string, discard: boolean): void {
		const capture = captures.get(id);
		if (!capture) return;
		capture.discard ||= discard;
		capture.stopRequested = true;
		if (capture.recorder && capture.recorder.state !== 'inactive') {
			try {
				capture.recorder.stop();
			} catch (error) {
				capture.error ||= captureError(error, 'Failed to stop the recording.');
			}
		}
	}

	async function startCapture(id: string, duration: number): Promise<void> {
		if (captures.size > 0) {
			await api
				.complete({ id, error: 'A recording is already in progress.' })
				.catch(() => undefined);
			return;
		}
		const capture: ActiveCapture = {
			recorder: null,
			stream: null,
			timer: 0,
			discard: false,
			stopRequested: false,
			sequence: 0,
			pendingChunks: 0,
			writeChain: Promise.resolve(),
			error: null,
			removeEndedListener: null,
		};
		captures.set(id, capture);
		try {
			if (typeof MediaRecorder === 'undefined') {
				throw new Error('MediaRecorder is not supported in this environment.');
			}
			const stream = await getStream();
			capture.stream = stream;
			if (capture.discard || capture.stopRequested) {
				stopStream(capture);
				captures.delete(id);
				return;
			}
			const mimeType = supportedMimeType(
				mediaKind === 'audio' ? AUDIO_MIME_TYPES : VIDEO_MIME_TYPES
			);
			const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
			capture.recorder = recorder;
			const actualMimeType = recorder.mimeType || mimeType || '';
			if (mediaKind === 'video' && !actualMimeType.toLowerCase().startsWith('video/webm')) {
				throw new Error('This environment does not provide a WebM video recorder.');
			}

			const endedTrack = stream.getVideoTracks()[0] ?? stream.getAudioTracks()[0];
			if (endedTrack) {
				const handleEnded = (): void => stopCapture(id, false);
				endedTrack.addEventListener('ended', handleEnded, { once: true });
				capture.removeEndedListener = () => endedTrack.removeEventListener('ended', handleEnded);
			}

			recorder.ondataavailable = (event): void => {
				if (event.data.size === 0 || capture.discard || capture.error) return;
				if (capture.pendingChunks >= MAX_PENDING_CHUNKS) {
					capture.error = 'Recording output cannot keep up with capture.';
					stopCapture(id, false);
					return;
				}
				const sequence = capture.sequence++;
				capture.pendingChunks += 1;
				capture.writeChain = capture.writeChain
					.then(async () => {
						const data = new Uint8Array(await event.data.arrayBuffer());
						await api.chunk({ id, sequence, data });
					})
					.catch((error) => {
						capture.error ||= captureError(error, 'Failed to save the recording chunk.');
						stopCapture(id, false);
					})
					.finally(() => {
						capture.pendingChunks -= 1;
					});
			};
			recorder.onerror = () => {
				capture.error ||= 'Recording failed while capturing media.';
				stopCapture(id, false);
			};
			recorder.onstop = async (): Promise<void> => {
				window.clearTimeout(capture.timer);
				stopStream(capture);
				await capture.writeChain;
				captures.delete(id);
				if (capture.discard) return;
				if (capture.error) {
					await api.complete({ id, error: capture.error }).catch(() => undefined);
					return;
				}
				await api.complete({ id, mimeType: actualMimeType || undefined }).catch(() => undefined);
			};
			recorder.start(CHUNK_TIMESLICE_MS);
			capture.timer = window.setTimeout(() => stopCapture(id, false), duration);
		} catch (error) {
			window.clearTimeout(capture.timer);
			stopStream(capture);
			captures.delete(id);
			if (!capture.discard) {
				await api
					.complete({ id, error: captureError(error, 'Media capture failed.') })
					.catch(() => undefined);
			}
		}
	}

	const disposeCommand = api.onCommand((command) => {
		if (command.type === 'start') void startCapture(command.id, command.duration);
		else stopCapture(command.id, command.type === 'cancel');
	});

	return () => {
		disposeCommand();
		captures.forEach((capture) => {
			capture.discard = true;
			window.clearTimeout(capture.timer);
			if (capture.recorder && capture.recorder.state !== 'inactive') capture.recorder.stop();
			stopStream(capture);
		});
		captures.clear();
	};
}

export function initRecorderCapture(): () => void {
	const screenVideo = {
		video: {
			width: { ideal: 1920 },
			height: { ideal: 1080 },
			frameRate: { ideal: 30, max: 60 },
		},
	};
	const disposers = [
		createCaptureHost(
			window.recorder.microphone,
			async () =>
				navigator.mediaDevices.getUserMedia({
					audio: await getMicrophoneConstraints({ echoCancellation: true, noiseSuppression: true }),
				}),
			'audio'
		),
		createCaptureHost(
			window.recorder.camera,
			async () =>
				navigator.mediaDevices.getUserMedia({
					audio: await getMicrophoneConstraints(),
					video: true,
				}),
			'video'
		),
		createCaptureHost(
			window.recorder.screen,
			() => navigator.mediaDevices.getDisplayMedia(screenVideo),
			'video'
		),
	];
	return () => disposers.forEach((dispose) => dispose());
}
