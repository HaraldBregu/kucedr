import { useCallback, useEffect, useRef, useState } from 'react';
import { base64ToPcm16 } from './audio';

const SAMPLE_RATE = 24_000;

export function usePcmPlayback() {
	const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const mountedRef = useRef(true);
	const contextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
	const nextTimeRef = useRef(0);

	const stop = useCallback((): void => {
		for (const source of sourcesRef.current) {
			try {
				source.stop();
			} catch {
				source.onended = null;
			}
		}
		sourcesRef.current.clear();
		nextTimeRef.current = contextRef.current?.currentTime ?? 0;
		if (mountedRef.current) setIsPlaying(false);
	}, []);

	const release = useCallback((): void => {
		stop();
		analyserRef.current?.disconnect();
		analyserRef.current = null;
		void contextRef.current?.close().catch(() => undefined);
		contextRef.current = null;
		if (mountedRef.current) setAnalyser(null);
	}, [stop]);

	const start = useCallback(async (): Promise<void> => {
		release();
		const context = new AudioContext({ sampleRate: SAMPLE_RATE });
		const outputAnalyser = context.createAnalyser();
		outputAnalyser.fftSize = 512;
		outputAnalyser.smoothingTimeConstant = 0.72;
		outputAnalyser.connect(context.destination);
		contextRef.current = context;
		analyserRef.current = outputAnalyser;
		setAnalyser(outputAnalyser);
		await context.resume();
	}, [release]);

	const enqueue = useCallback((base64: string): void => {
		const context = contextRef.current;
		const outputAnalyser = analyserRef.current;
		if (!context || !outputAnalyser) return;
		const pcm = base64ToPcm16(base64);
		if (pcm.length === 0) return;
		const buffer = context.createBuffer(1, pcm.length, SAMPLE_RATE);
		const samples = buffer.getChannelData(0);
		for (let index = 0; index < pcm.length; index += 1) {
			samples[index] = (pcm[index] ?? 0) / 0x8000;
		}
		const source = context.createBufferSource();
		source.buffer = buffer;
		source.connect(outputAnalyser);
		const startAt = Math.max(context.currentTime, nextTimeRef.current);
		nextTimeRef.current = startAt + buffer.duration;
		sourcesRef.current.add(source);
		setIsPlaying(true);
		source.onended = () => {
			sourcesRef.current.delete(source);
			if (sourcesRef.current.size === 0 && mountedRef.current) setIsPlaying(false);
		};
		source.start(startAt);
	}, []);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			release();
		};
	}, [release]);

	return { analyser, enqueue, isPlaying, release, start, stop };
}
