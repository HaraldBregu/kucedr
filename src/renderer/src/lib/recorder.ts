import { getMicrophoneConstraints } from '@/lib/microphone/constraints';
import type { RecorderApi } from '@shared/api_types';

type RecorderTrack = RecorderApi['microphone'];

type ActiveCapture = {
	recorder: MediaRecorder;
	stream: MediaStream;
	chunks: Blob[];
	timer: number;
	discard: boolean;
};

function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(reader.error ?? new Error('Failed to read recorded data.'));
		reader.onload = () => {
			const dataUrl = reader.result as string;
			resolve(dataUrl.slice(dataUrl.indexOf(';base64,') + 8));
		};
		reader.readAsDataURL(blob);
	});
}

function createCaptureHost(api: RecorderTrack, getStream: () => Promise<MediaStream>): () => void {
	const captures = new Map<string, ActiveCapture>();

	function report(result: Parameters<RecorderTrack['complete']>[0]): void {
		api.complete(result).catch(() => undefined);
	}

	function stopCapture(id: string, discard: boolean): void {
		const capture = captures.get(id);
		if (!capture) return;
		capture.discard = capture.discard || discard;
		if (capture.recorder.state !== 'inactive') capture.recorder.stop();
	}

	async function startCapture(id: string, duration: number): Promise<void> {
		try {
			const stream = await getStream();
			const recorder = new MediaRecorder(stream);
			const capture: ActiveCapture = { recorder, stream, chunks: [], timer: 0, discard: false };
			captures.set(id, capture);

			recorder.ondataavailable = (event): void => {
				if (event.data.size > 0) capture.chunks.push(event.data);
			};
			recorder.onstop = async (): Promise<void> => {
				window.clearTimeout(capture.timer);
				stream.getTracks().forEach((track) => track.stop());
				captures.delete(id);
				if (capture.discard) return;
				try {
					const blob = new Blob(
						capture.chunks,
						recorder.mimeType ? { type: recorder.mimeType } : undefined
					);
					const base64 = await blobToBase64(blob);
					report({ id, base64, mimeType: blob.type || undefined });
				} catch (error) {
					report({
						id,
						error: error instanceof Error ? error.message : 'Failed to read the recording.',
					});
				}
			};
			recorder.start();
			capture.timer = window.setTimeout(() => stopCapture(id, false), duration);
		} catch (error) {
			report({
				id,
				error: error instanceof Error ? error.message : 'Media capture failed.',
			});
		}
	}

	return api.onCommand((command) => {
		if (command.type === 'start') void startCapture(command.id, command.duration);
		else stopCapture(command.id, command.type === 'cancel');
	});
}

export function initRecorderCapture(): () => void {
	const disposers = [
		createCaptureHost(window.recorder.microphone, async () =>
			navigator.mediaDevices.getUserMedia({
				audio: await getMicrophoneConstraints({ echoCancellation: true, noiseSuppression: true }),
			})
		),
		createCaptureHost(window.recorder.camera, async () =>
			navigator.mediaDevices.getUserMedia({ audio: await getMicrophoneConstraints(), video: true })
		),
		createCaptureHost(window.recorder.screen, () =>
			navigator.mediaDevices.getDisplayMedia({ video: true })
		),
	];
	return () => disposers.forEach((dispose) => dispose());
}
