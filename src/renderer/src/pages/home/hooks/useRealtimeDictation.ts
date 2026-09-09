import { getMicrophoneConstraints } from '@/lib/microphone/constraints';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SttRealtimeEvent } from '@shared/stt_transcription';

export type RealtimeDictationStatus =
	| 'idle'
	| 'checking-permission'
	| 'connecting'
	| 'recording'
	| 'finishing'
	| 'error';

const AUDIO_BUFFER_SIZE = 4096;
const CLOCK_INTERVAL_MS = 250;

function canCaptureAudio(): boolean {
	return Boolean(
		navigator.mediaDevices &&
		typeof navigator.mediaDevices.getUserMedia === 'function' &&
		typeof AudioContext !== 'undefined'
	);
}

async function getAppMicrophoneEnabled(): Promise<boolean> {
	try {
		const settings = await window.app.getMicrophonePermission();
		return (
			settings.enabled &&
			settings.systemStatus !== 'denied' &&
			settings.systemStatus !== 'restricted'
		);
	} catch {
		return true;
	}
}

function dictationErrorMessage(error: unknown): string {
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

	return 'Live dictation failed.';
}

function mergeDictationText(baseText: string, transcript: string): string {
	if (!baseText) return transcript;
	if (!transcript) return baseText;
	const separator = /\s$/.test(baseText) || /^\s/.test(transcript) ? '' : ' ';
	return `${baseText}${separator}${transcript}`;
}

function stopStream(stream: MediaStream | null): void {
	stream?.getTracks().forEach((track) => track.stop());
}

function resampleToPcm16(input: Float32Array, inputRate: number, outputRate: number): Int16Array {
	if (input.length === 0) return new Int16Array();
	const ratio = inputRate / outputRate;
	const outputLength = Math.max(1, Math.floor(input.length / ratio));
	const output = new Int16Array(outputLength);
	let inputOffset = 0;

	for (let outputOffset = 0; outputOffset < outputLength; outputOffset += 1) {
		const nextInputOffset = Math.min(input.length, Math.round((outputOffset + 1) * ratio));
		let sum = 0;
		let count = 0;

		for (; inputOffset < nextInputOffset; inputOffset += 1) {
			sum += input[inputOffset] ?? 0;
			count += 1;
		}

		const sample = Math.max(-1, Math.min(1, count > 0 ? sum / count : 0));
		output[outputOffset] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
	}

	return output;
}

function pcm16ToBase64(pcm: Int16Array): string {
	const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
	let binary = '';
	const chunkSize = 0x8000;

	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		const chunk = bytes.subarray(offset, offset + chunkSize);
		binary += String.fromCharCode(...chunk);
	}

	return btoa(binary);
}

function preferredLanguage(): string | undefined {
	const language = navigator.language?.trim();
	if (!language) return undefined;
	return language.slice(0, 2).toLowerCase();
}

export function useRealtimeDictation({
	value,
	onValueChange,
}: {
	readonly value: string;
	readonly onValueChange: (value: string) => void;
}) {
	const [status, setStatus] = useState<RealtimeDictationStatus>('idle');
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [elapsedMs, setElapsedMs] = useState(0);
	const [isMuted, setIsMuted] = useState(false);
	const [stream, setStream] = useState<MediaStream | null>(null);

	const valueRef = useRef(value);
	const onValueChangeRef = useRef(onValueChange);
	const sessionIdRef = useRef<string | null>(null);
	const baseTextRef = useRef('');
	const itemOrderRef = useRef<string[]>([]);
	const itemTextRef = useRef<Map<string, string>>(new Map());
	const streamRef = useRef<MediaStream | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
	const processorRef = useRef<ScriptProcessorNode | null>(null);
	const clockRef = useRef<number | null>(null);
	const startedAtMsRef = useRef(0);
	const mutedRef = useRef(false);

	useEffect(() => {
		valueRef.current = value;
	}, [value]);

	useEffect(() => {
		onValueChangeRef.current = onValueChange;
	}, [onValueChange]);

	const stopClock = useCallback((): void => {
		if (clockRef.current === null) return;
		window.clearInterval(clockRef.current);
		clockRef.current = null;
	}, []);

	const startClock = useCallback((): void => {
		stopClock();
		startedAtMsRef.current = Date.now();
		clockRef.current = window.setInterval(() => {
			setElapsedMs(Date.now() - startedAtMsRef.current);
		}, CLOCK_INTERVAL_MS);
	}, [stopClock]);

	const stopAudio = useCallback((): void => {
		processorRef.current?.disconnect();
		sourceRef.current?.disconnect();
		void audioContextRef.current?.close().catch(() => undefined);
		stopStream(streamRef.current);
		processorRef.current = null;
		sourceRef.current = null;
		audioContextRef.current = null;
		streamRef.current = null;
		setStream(null);
	}, []);

	const resetTranscript = useCallback((): void => {
		itemOrderRef.current = [];
		itemTextRef.current = new Map();
	}, []);

	const applyTranscript = useCallback((): void => {
		const transcript = itemOrderRef.current
			.map((itemId) => itemTextRef.current.get(itemId)?.trim() ?? '')
			.filter(Boolean)
			.join(' ');
		onValueChangeRef.current(mergeDictationText(baseTextRef.current, transcript));
	}, []);

	const ensureItem = useCallback((itemId: string): void => {
		if (itemTextRef.current.has(itemId)) return;
		itemTextRef.current.set(itemId, '');
		itemOrderRef.current.push(itemId);
	}, []);

	useEffect(() => {
		const api = window.models.transcribe;
		if (!api) return;

		return api.onRealtimeEvent((event: SttRealtimeEvent) => {
			if (event.sessionId && event.sessionId !== sessionIdRef.current) return;

			if (event.type === 'committed') {
				ensureItem(event.itemId);
				return;
			}

			if (event.type === 'delta') {
				ensureItem(event.itemId);
				itemTextRef.current.set(
					event.itemId,
					`${itemTextRef.current.get(event.itemId) ?? ''}${event.delta}`
				);
				applyTranscript();
				return;
			}

			if (event.type === 'completed') {
				ensureItem(event.itemId);
				itemTextRef.current.set(event.itemId, event.transcript);
				applyTranscript();
				return;
			}

			if (event.type === 'error') {
				setErrorMessage(event.message);
				setStatus('error');
				return;
			}

			if (event.type === 'closed') {
				sessionIdRef.current = null;
				stopClock();
				stopAudio();
				setIsMuted(false);
				mutedRef.current = false;
				setElapsedMs(0);
				setStatus((current) => (current === 'error' ? current : 'idle'));
			}
		});
	}, [applyTranscript, ensureItem, stopAudio, stopClock]);

	const setMuted = useCallback((nextMuted: boolean): void => {
		mutedRef.current = nextMuted;
		setIsMuted(nextMuted);
		streamRef.current?.getAudioTracks().forEach((track) => {
			track.enabled = !nextMuted;
		});
	}, []);

	const start = useCallback(async (): Promise<boolean> => {
		if (status === 'recording' || status === 'connecting') return true;
		if (!canCaptureAudio()) {
			setStatus('error');
			setErrorMessage('Live dictation is not supported in this environment.');
			return false;
		}

		setStatus('checking-permission');
		setErrorMessage(null);
		setElapsedMs(0);
		resetTranscript();
		baseTextRef.current = valueRef.current;

		try {
			const transcriptionApi = window.models.transcribe;
			if (!transcriptionApi) {
				throw new Error('Speech-to-text API is unavailable.');
			}
			if (!(await getAppMicrophoneEnabled())) {
				throw new Error('Microphone recording is disabled in Settings.');
			}

			const mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: await getMicrophoneConstraints({
					echoCancellation: true,
					noiseSuppression: true,
					channelCount: 1,
				}),
			});

			setStatus('connecting');
			const session = await transcriptionApi.startRealtime({
				language: preferredLanguage(),
			});
			sessionIdRef.current = session.id;

			const audioContext = new AudioContext({ sampleRate: session.sampleRate });
			const source = audioContext.createMediaStreamSource(mediaStream);
			const processor = audioContext.createScriptProcessor(AUDIO_BUFFER_SIZE, 1, 1);

			processor.onaudioprocess = (event): void => {
				const sessionId = sessionIdRef.current;
				if (!sessionId || mutedRef.current) return;
				const input = event.inputBuffer.getChannelData(0);
				const pcm = resampleToPcm16(input, audioContext.sampleRate, session.sampleRate);
				if (pcm.length === 0) return;
				void transcriptionApi.appendRealtimeAudio(sessionId, pcm16ToBase64(pcm));
			};

			source.connect(processor);
			processor.connect(audioContext.destination);
			await audioContext.resume();

			streamRef.current = mediaStream;
			audioContextRef.current = audioContext;
			sourceRef.current = source;
			processorRef.current = processor;
			setStream(mediaStream);
			setMuted(false);
			setStatus('recording');
			startClock();
			return true;
		} catch (error) {
			if (sessionIdRef.current) {
				await window.models.transcribe?.cancelRealtime(sessionIdRef.current).catch(() => undefined);
				sessionIdRef.current = null;
			}
			stopClock();
			stopAudio();
			setStatus('error');
			setErrorMessage(dictationErrorMessage(error));
			return false;
		}
	}, [resetTranscript, setMuted, startClock, status, stopAudio, stopClock]);

	const cancel = useCallback(async (): Promise<void> => {
		const sessionId = sessionIdRef.current;
		sessionIdRef.current = null;
		stopClock();
		stopAudio();
		onValueChangeRef.current(baseTextRef.current);
		setIsMuted(false);
		mutedRef.current = false;
		setElapsedMs(0);
		setStatus('idle');
		if (sessionId) await window.models.transcribe?.cancelRealtime(sessionId).catch(() => undefined);
	}, [stopAudio, stopClock]);

	const finish = useCallback(async (): Promise<void> => {
		const sessionId = sessionIdRef.current;
		stopClock();
		stopAudio();
		setIsMuted(false);
		mutedRef.current = false;
		setElapsedMs(0);
		if (!sessionId) {
			setStatus('idle');
			return;
		}

		setStatus('finishing');
		try {
			await window.models.transcribe?.finishRealtime(sessionId);
		} catch (error) {
			sessionIdRef.current = null;
			setStatus('error');
			setErrorMessage(dictationErrorMessage(error));
		}
	}, [stopAudio, stopClock]);

	useEffect(() => {
		return () => {
			const sessionId = sessionIdRef.current;
			sessionIdRef.current = null;
			stopClock();
			stopAudio();
			if (sessionId)
				void window.models.transcribe?.cancelRealtime(sessionId).catch(() => undefined);
		};
	}, [stopAudio, stopClock]);

	return {
		cancel,
		elapsedMs,
		errorMessage,
		finish,
		isMuted,
		isSupported: canCaptureAudio(),
		setMuted,
		start,
		status,
		stream,
	};
}
