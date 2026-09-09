import { getMicrophoneConstraints } from '@/lib/microphone/constraints';
import { useCallback, useEffect, useRef, useState } from 'react';
import { pcm16ToBase64, resampleToPcm16, stopStream } from './audio';

const AUDIO_BUFFER_SIZE = 4096;
const OUTPUT_SAMPLE_RATE = 24_000;

export function usePcmCapture() {
	const [stream, setStream] = useState<MediaStream | null>(null);
	const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
	const [isMuted, setIsMuted] = useState(false);
	const mountedRef = useRef(true);
	const mutedRef = useRef(false);
	const streamRef = useRef<MediaStream | null>(null);
	const contextRef = useRef<AudioContext | null>(null);
	const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const processorRef = useRef<ScriptProcessorNode | null>(null);

	const stop = useCallback((): void => {
		processorRef.current?.disconnect();
		sourceRef.current?.disconnect();
		analyserRef.current?.disconnect();
		processorRef.current = null;
		sourceRef.current = null;
		analyserRef.current = null;
		stopStream(streamRef.current);
		streamRef.current = null;
		void contextRef.current?.close().catch(() => undefined);
		contextRef.current = null;
		mutedRef.current = false;
		if (mountedRef.current) {
			setStream(null);
			setAnalyser(null);
			setIsMuted(false);
		}
	}, []);

	const start = useCallback(
		async (onAudio: (audio: string) => void): Promise<void> => {
			stop();
			const mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: await getMicrophoneConstraints({
					echoCancellation: true,
					noiseSuppression: true,
					channelCount: 1,
				}),
			});
			let context: AudioContext | null = null;
			try {
				context = new AudioContext();
				const source = context.createMediaStreamSource(mediaStream);
				const inputAnalyser = context.createAnalyser();
				inputAnalyser.fftSize = 512;
				inputAnalyser.smoothingTimeConstant = 0.72;
				const processor = context.createScriptProcessor(AUDIO_BUFFER_SIZE, 1, 1);
				processor.onaudioprocess = (event): void => {
					if (mutedRef.current) return;
					const input = event.inputBuffer.getChannelData(0);
					const pcm = resampleToPcm16(
						input,
						context?.sampleRate ?? OUTPUT_SAMPLE_RATE,
						OUTPUT_SAMPLE_RATE
					);
					if (pcm.length > 0) onAudio(pcm16ToBase64(pcm));
				};
				source.connect(inputAnalyser);
				source.connect(processor);
				processor.connect(context.destination);
				streamRef.current = mediaStream;
				contextRef.current = context;
				sourceRef.current = source;
				analyserRef.current = inputAnalyser;
				processorRef.current = processor;
				setStream(mediaStream);
				setAnalyser(inputAnalyser);
				await context.resume();
			} catch (error) {
				stop();
				stopStream(mediaStream);
				void context?.close().catch(() => undefined);
				throw error;
			}
		},
		[stop]
	);

	const setMuted = useCallback((nextMuted: boolean): void => {
		mutedRef.current = nextMuted;
		setIsMuted(nextMuted);
		streamRef.current?.getAudioTracks().forEach((track) => {
			track.enabled = !nextMuted;
		});
	}, []);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			stop();
		};
	}, [stop]);

	return { analyser, isMuted, setMuted, start, stop, stream };
}
