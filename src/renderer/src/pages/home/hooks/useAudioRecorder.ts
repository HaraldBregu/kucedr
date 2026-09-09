import { getMicrophoneConstraints } from '@/lib/microphone/constraints';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MicrophonePermissionSettings } from '@shared/app_types';

export type AudioRecorderStatus = 'idle' | 'checking-permission' | 'recording' | 'stopping' | 'error';
export type AudioRecorderPermissionState =
	| 'unknown'
	| 'prompt'
	| 'granted'
	| 'denied'
	| 'disabled'
	| 'unsupported';

export type AudioRecording = {
	readonly id: string;
	readonly file: File;
	readonly url?: string;
	readonly durationMs: number;
	readonly mimeType: string;
	readonly size: number;
};

const AUDIO_MIME_TYPES = [
	'audio/webm;codecs=opus',
	'audio/webm',
	'audio/mp4',
	'audio/ogg;codecs=opus',
] as const;

const RECORDING_TIMESLICE_MS = 1000;
const CLOCK_INTERVAL_MS = 250;

function canRecordAudio(): boolean {
	const mediaDevices = navigator.mediaDevices as MediaDevices | undefined;
	return Boolean(
		mediaDevices &&
			typeof mediaDevices.getUserMedia === 'function' &&
			typeof MediaRecorder !== 'undefined'
	);
}

function supportedMimeType(): string | undefined {
	if (typeof MediaRecorder === 'undefined') return undefined;
	return AUDIO_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

function extensionForMimeType(mimeType: string): string {
	if (mimeType.startsWith('audio/mp4')) return 'm4a';
	if (mimeType.startsWith('audio/ogg')) return 'ogg';
	return 'webm';
}

function createRecordingId(): string {
	if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
	return `audio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createRecordingFileName(mimeType: string): string {
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	return `kucedr-audio-${timestamp}.${extensionForMimeType(mimeType)}`;
}

function normalizePermissionState(state: PermissionState): AudioRecorderPermissionState {
	if (state === 'granted' || state === 'denied' || state === 'prompt') return state;
	return 'unknown';
}

async function queryMicrophonePermission(): Promise<AudioRecorderPermissionState> {
	if (!navigator.permissions?.query) return 'unknown';

	try {
		const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
		return normalizePermissionState(status.state);
	} catch {
		return 'unknown';
	}
}

async function getAppMicrophonePermission(): Promise<MicrophonePermissionSettings | null> {
	const appApi = (window as Window & { app?: Partial<Window['app']> }).app;
	if (!appApi?.getMicrophonePermission) return null;

	try {
		return await appApi.getMicrophonePermission();
	} catch {
		return null;
	}
}

function recorderErrorMessage(error: unknown): string {
	if (error instanceof DOMException) {
		if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
			return 'Microphone access is blocked. Allow microphone access and try again.';
		}

		if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
			return 'No microphone was found.';
		}
	}

	if (error instanceof Error && error.message.trim().length > 0) {
		return error.message;
	}

	return 'Audio recording failed.';
}

function stopStream(stream: MediaStream | null): void {
	stream?.getTracks().forEach((track) => track.stop());
}

function objectUrlForBlob(blob: Blob): string | undefined {
	if (typeof URL.createObjectURL !== 'function') return undefined;
	return URL.createObjectURL(blob);
}

export function useAudioRecorder() {
	const [status, setStatus] = useState<AudioRecorderStatus>('idle');
	const [permissionState, setPermissionState] =
		useState<AudioRecorderPermissionState>('unknown');
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [elapsedMs, setElapsedMs] = useState(0);
	const [isMuted, setIsMuted] = useState(false);
	const [stream, setStream] = useState<MediaStream | null>(null);

	const recorderRef = useRef<MediaRecorder | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const startedAtMsRef = useRef(0);
	const clockRef = useRef<number | null>(null);
	const discardOnStopRef = useRef(false);
	const stopResolverRef = useRef<((recording: AudioRecording | null) => void) | null>(null);

	const stopClock = useCallback((): void => {
		if (clockRef.current === null) return;
		window.clearInterval(clockRef.current);
		clockRef.current = null;
	}, []);

	const startClock = useCallback((): void => {
		stopClock();
		clockRef.current = window.setInterval(() => {
			setElapsedMs(Date.now() - startedAtMsRef.current);
		}, CLOCK_INTERVAL_MS);
	}, [stopClock]);

	const resetRecorder = useCallback((): void => {
		stopClock();
		stopStream(streamRef.current);
		recorderRef.current = null;
		streamRef.current = null;
		setStream(null);
		chunksRef.current = [];
		startedAtMsRef.current = 0;
		discardOnStopRef.current = false;
		stopResolverRef.current = null;
		setIsMuted(false);
		setElapsedMs(0);
	}, [stopClock]);

	const setMuted = useCallback((nextMuted: boolean): void => {
		setIsMuted(nextMuted);
		streamRef.current?.getAudioTracks().forEach((track) => {
			track.enabled = !nextMuted;
		});
	}, []);

	const start = useCallback(async (): Promise<boolean> => {
		if (recorderRef.current?.state === 'recording') return true;

		if (!canRecordAudio()) {
			setPermissionState('unsupported');
			setStatus('error');
			setErrorMessage('Audio recording is not supported in this environment.');
			return false;
		}

		setStatus('checking-permission');
		setErrorMessage(null);
		setElapsedMs(0);

		try {
			const nextPermissionState = await queryMicrophonePermission();
			setPermissionState(nextPermissionState);
			if (nextPermissionState === 'denied') {
				throw new Error('Microphone access is blocked. Allow microphone access and try again.');
			}

			const appPermission = await getAppMicrophonePermission();
			if (appPermission && !appPermission.enabled) {
				setPermissionState('disabled');
				throw new Error('Microphone recording is disabled in Settings.');
			}

			if (
				appPermission?.systemStatus === 'denied' ||
				appPermission?.systemStatus === 'restricted'
			) {
				setPermissionState('denied');
				throw new Error('Microphone access is blocked. Allow microphone access and try again.');
			}

			const stream = await navigator.mediaDevices.getUserMedia({
				audio: await getMicrophoneConstraints({
					echoCancellation: true,
					noiseSuppression: true,
				}),
			});
			const mimeType = supportedMimeType();
			const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

			recorderRef.current = recorder;
			streamRef.current = stream;
			setStream(stream);
			chunksRef.current = [];
			startedAtMsRef.current = Date.now();

			recorder.ondataavailable = (event): void => {
				if (event.data.size > 0) chunksRef.current.push(event.data);
			};

			recorder.onerror = (): void => {
				setStatus('error');
				setErrorMessage('Audio recording failed.');
			};

			recorder.onstop = (): void => {
				const chunks = chunksRef.current;
				const shouldDiscard = discardOnStopRef.current;
				const resolveStop = stopResolverRef.current;
				const durationMs = Math.max(0, Date.now() - startedAtMsRef.current);
				const recorderMimeType = recorder.mimeType || mimeType || 'audio/webm';

				resetRecorder();
				setStatus('idle');

				if (shouldDiscard || chunks.length === 0) {
					resolveStop?.(null);
					return;
				}

				const blob = new Blob(chunks, { type: recorderMimeType });
				if (blob.size === 0) {
					resolveStop?.(null);
					return;
				}

				const file = new File([blob], createRecordingFileName(blob.type), {
					type: blob.type,
					lastModified: Date.now(),
				});

				resolveStop?.({
					id: createRecordingId(),
					file,
					url: objectUrlForBlob(blob),
					durationMs,
					mimeType: blob.type,
					size: blob.size,
				});
			};

			recorder.start(RECORDING_TIMESLICE_MS);
			setPermissionState('granted');
			setStatus('recording');
			startClock();
			return true;
		} catch (error) {
			resetRecorder();
			setStatus('error');
			setErrorMessage(recorderErrorMessage(error));
			return false;
		}
	}, [resetRecorder, startClock]);

	const stop = useCallback(async (): Promise<AudioRecording | null> => {
		const recorder = recorderRef.current;
		if (!recorder || recorder.state === 'inactive') return null;

		setStatus('stopping');
		stopClock();
		discardOnStopRef.current = false;

		return new Promise((resolve) => {
			stopResolverRef.current = resolve;
			try {
				recorder.stop();
			} catch (error) {
				resetRecorder();
				setStatus('error');
				setErrorMessage(recorderErrorMessage(error));
				resolve(null);
			}
		});
	}, [resetRecorder, stopClock]);

	const cancel = useCallback(async (): Promise<void> => {
		const recorder = recorderRef.current;
		if (!recorder || recorder.state === 'inactive') {
			resetRecorder();
			setStatus('idle');
			return;
		}

		setStatus('stopping');
		stopClock();
		discardOnStopRef.current = true;

		await new Promise<void>((resolve) => {
			stopResolverRef.current = () => resolve();
			try {
				recorder.stop();
			} catch {
				resetRecorder();
				setStatus('idle');
				resolve();
			}
		});
	}, [resetRecorder, stopClock]);

	useEffect(() => {
		return () => {
			const recorder = recorderRef.current;
			stopClock();
			if (recorder && recorder.state !== 'inactive') {
				recorder.onstop = null;
				try {
					recorder.stop();
				} catch {
					// ignore teardown errors
				}
			}
			stopStream(streamRef.current);
		};
	}, [stopClock]);

	return {
		cancel,
		elapsedMs,
		errorMessage,
		isMuted,
		isSupported: canRecordAudio(),
		permissionState,
		setMuted,
		start,
		status,
		stream,
		stop,
	};
}
