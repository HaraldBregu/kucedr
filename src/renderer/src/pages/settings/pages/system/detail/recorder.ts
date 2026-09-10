import { getMicrophoneConstraints } from '@/lib/microphone/constraints';
import { getScreenRecordingStream } from '@/lib/microphone/screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SystemMedia } from './media';

export type RecorderState = 'idle' | 'starting' | 'recording' | 'recorded';

export interface MediaRecorderTest {
	readonly state: RecorderState;
	readonly error: string;
	readonly audioUnavailable: boolean;
	readonly recordedUrl: string | null;
	readonly elapsedSeconds: number;
	readonly videoRef: React.RefObject<HTMLVideoElement | null>;
	readonly start: () => Promise<void>;
	readonly stop: () => void;
	readonly reset: () => void;
}

export function useMediaRecorderTest(media: SystemMedia): MediaRecorderTest {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const recorderRef = useRef<MediaRecorder | null>(null);
	const urlRef = useRef<string | null>(null);
	const timerRef = useRef<number | null>(null);
	const generationRef = useRef(0);
	const startingRef = useRef(false);

	const [state, setState] = useState<RecorderState>('idle');
	const [error, setError] = useState('');
	const [audioUnavailable, setAudioUnavailable] = useState(false);
	const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
	const [elapsedSeconds, setElapsedSeconds] = useState(0);

	const stopStream = useCallback((stream: MediaStream | null = streamRef.current) => {
		stream?.getTracks().forEach((track) => track.stop());
		if (streamRef.current !== stream) return;
		streamRef.current = null;
		if (videoRef.current?.srcObject === stream) videoRef.current.srcObject = null;
	}, []);

	const clearTimer = useCallback(() => {
		if (timerRef.current !== null) {
			window.clearInterval(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const stop = useCallback(() => {
		if (startingRef.current) {
			startingRef.current = false;
			generationRef.current += 1;
			setState('idle');
		}
		clearTimer();
		if (recorderRef.current && recorderRef.current.state !== 'inactive') {
			recorderRef.current.stop();
		}
		stopStream();
	}, [clearTimer, stopStream]);

	const start = useCallback(async () => {
		if (startingRef.current || recorderRef.current?.state === 'recording') return;
		const generation = generationRef.current + 1;
		generationRef.current = generation;
		startingRef.current = true;
		setState('starting');
		setError('');
		setAudioUnavailable(false);
		if (urlRef.current) {
			URL.revokeObjectURL(urlRef.current);
			urlRef.current = null;
		}
		setRecordedUrl(null);
		setElapsedSeconds(0);

		let stream: MediaStream | null = null;
		try {
			if (media.source === 'display') {
				const captured = await getScreenRecordingStream(media.constraints);
				stream = captured.stream;
				setAudioUnavailable(!captured.hasMicrophone);
			} else {
				stream = await navigator.mediaDevices.getUserMedia(
							media.id === 'microphone'
								? { audio: await getMicrophoneConstraints() }
								: media.constraints
						);
			}
			if (generationRef.current !== generation) {
				stopStream(stream);
				return;
			}
			streamRef.current = stream;

			if (media.video && videoRef.current) {
				videoRef.current.srcObject = stream;
				await videoRef.current.play().catch(() => undefined);
			}
			stream.getVideoTracks()[0]?.addEventListener('ended', () => stop());

			const chunks: Blob[] = [];
			const recorder = new MediaRecorder(stream);
			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) chunks.push(event.data);
			};
			recorder.onstop = () => {
				if (generationRef.current !== generation || recorderRef.current !== recorder) return;
				recorderRef.current = null;
				const blob = new Blob(chunks, { type: recorder.mimeType || undefined });
				const url = URL.createObjectURL(blob);
				urlRef.current = url;
				setRecordedUrl(url);
				setState('recorded');
			};
			recorderRef.current = recorder;
			recorder.start();
			setState('recording');
			timerRef.current = window.setInterval(() => {
				setElapsedSeconds((seconds) => seconds + 1);
			}, 1000);
		} catch (err) {
			stopStream(stream);
			if (generationRef.current === generation) {
				recorderRef.current = null;
				setState('idle');
				setError(err instanceof Error ? err.message : String(err));
			}
		} finally {
			if (generationRef.current === generation) startingRef.current = false;
		}
	}, [media, stop, stopStream]);

	const reset = useCallback(() => {
		generationRef.current += 1;
		startingRef.current = false;
		clearTimer();
		if (recorderRef.current) {
			recorderRef.current.onstop = null;
			if (recorderRef.current.state !== 'inactive') recorderRef.current.stop();
			recorderRef.current = null;
		}
		stopStream();
		if (urlRef.current) {
			URL.revokeObjectURL(urlRef.current);
			urlRef.current = null;
		}
		setRecordedUrl(null);
		setElapsedSeconds(0);
		setError('');
		setAudioUnavailable(false);
		setState('idle');
	}, [clearTimer, stopStream]);

	useEffect(() => {
		return () => {
			generationRef.current += 1;
			startingRef.current = false;
			if (timerRef.current !== null) window.clearInterval(timerRef.current);
			if (recorderRef.current) {
				recorderRef.current.onstop = null;
				if (recorderRef.current.state !== 'inactive') recorderRef.current.stop();
				recorderRef.current = null;
			}
			stopStream();
			if (urlRef.current) URL.revokeObjectURL(urlRef.current);
		};
	}, [media.id, stopStream]);

	return { state, error, audioUnavailable, recordedUrl, elapsedSeconds, videoRef, start, stop, reset };
}
