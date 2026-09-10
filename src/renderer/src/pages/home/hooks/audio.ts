import type { MicrophonePermissionSettings } from '@shared/app_types';

// ─── shared ──────────────────────────────────────────────────────────────────

export function stopStream(stream: MediaStream | null): void {
	stream?.getTracks().forEach((track) => track.stop());
}

// ─── dictation ───────────────────────────────────────────────────────────────

export function canCaptureAudio(): boolean {
	return Boolean(
		navigator.mediaDevices &&
			typeof navigator.mediaDevices.getUserMedia === 'function' &&
			typeof AudioContext !== 'undefined'
	);
}

export async function getAppMicrophoneEnabled(): Promise<boolean> {
	try {
		const settings = await window.app.getMicrophonePermission();
		return settings.enabled && settings.systemStatus !== 'denied' && settings.systemStatus !== 'restricted';
	} catch {
		return true;
	}
}

export async function ensureAppMicrophoneAccess(): Promise<void> {
	const settings = await window.app.getMicrophonePermission();
	if (!settings.enabled) throw new Error('Microphone recording is disabled in Settings.');
	if (settings.systemStatus === 'denied' || settings.systemStatus === 'restricted') {
		throw new Error('Microphone access is blocked. Allow microphone access and try again.');
	}
	if (!settings.canRequest) return;

	const requested = await window.app.requestMicrophonePermission();
	if (requested.systemStatus === 'denied' || requested.systemStatus === 'restricted') {
		throw new Error('Microphone access is blocked. Allow microphone access and try again.');
	}
}

export function dictationErrorMessage(error: unknown): string {
	if (error instanceof DOMException) {
		if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
			return 'Microphone access is blocked. Allow microphone access and try again.';
		}
		if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
			return 'No microphone was found.';
		}
	}
	if (error instanceof Error && error.message.trim().length > 0) return error.message;
	return 'Live dictation failed.';
}

export function mergeDictationText(baseText: string, transcript: string): string {
	if (!baseText) return transcript;
	if (!transcript) return baseText;
	const separator = /\s$/.test(baseText) || /^\s/.test(transcript) ? '' : ' ';
	return `${baseText}${separator}${transcript}`;
}

export function preferredLanguage(): string | undefined {
	const language = navigator.language?.trim();
	if (!language) return undefined;
	return language.slice(0, 2).toLowerCase();
}

export function resampleToPcm16(
	input: Float32Array,
	inputRate: number,
	outputRate: number
): Int16Array {
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

export function pcm16ToBase64(pcm: Int16Array): string {
	const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
	let binary = '';
	const chunkSize = 0x8000;

	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		const chunk = bytes.subarray(offset, offset + chunkSize);
		binary += String.fromCharCode(...chunk);
	}

	return btoa(binary);
}

export function base64ToPcm16(value: string): Int16Array {
	const binary = atob(value);
	const output = new Int16Array(Math.floor(binary.length / 2));
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	const view = new DataView(bytes.buffer);
	for (let index = 0; index < output.length; index += 1) {
		output[index] = view.getInt16(index * 2, true);
	}
	return output;
}

// ─── recording ───────────────────────────────────────────────────────────────

const AUDIO_MIME_TYPES = [
	'audio/webm;codecs=opus',
	'audio/webm',
	'audio/mp4',
	'audio/ogg;codecs=opus',
] as const;

export function canRecordAudio(): boolean {
	const mediaDevices = navigator.mediaDevices as MediaDevices | undefined;
	return Boolean(
		mediaDevices &&
			typeof mediaDevices.getUserMedia === 'function' &&
			typeof MediaRecorder !== 'undefined'
	);
}

export function supportedMimeType(): string | undefined {
	if (typeof MediaRecorder === 'undefined') return undefined;
	return AUDIO_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export function extensionForMimeType(mimeType: string): string {
	if (mimeType.startsWith('audio/mp4')) return 'm4a';
	if (mimeType.startsWith('audio/ogg')) return 'ogg';
	return 'webm';
}

export function createRecordingId(): string {
	if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
	return `audio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createRecordingFileName(mimeType: string): string {
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	return `kucedr-audio-${timestamp}.${extensionForMimeType(mimeType)}`;
}

export function normalizePermissionState(state: PermissionState): 'granted' | 'denied' | 'prompt' | 'unknown' {
	if (state === 'granted' || state === 'denied' || state === 'prompt') return state;
	return 'unknown';
}

export async function queryMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
	if (!navigator.permissions?.query) return 'unknown';
	try {
		const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
		return normalizePermissionState(status.state);
	} catch {
		return 'unknown';
	}
}

export async function getAppMicrophonePermission(): Promise<MicrophonePermissionSettings | null> {
	const appApi = (window as Window & { app?: Partial<Window['app']> }).app;
	if (!appApi?.getMicrophonePermission) return null;
	try {
		return await appApi.getMicrophonePermission();
	} catch {
		return null;
	}
}

export function recorderErrorMessage(error: unknown): string {
	if (error instanceof DOMException) {
		if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
			return 'Microphone access is blocked. Allow microphone access and try again.';
		}
		if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
			return 'No microphone was found.';
		}
	}
	if (error instanceof Error && error.message.trim().length > 0) return error.message;
	return 'Audio recording failed.';
}

export function objectUrlForBlob(blob: Blob): string | undefined {
	if (typeof URL.createObjectURL !== 'function') return undefined;
	return URL.createObjectURL(blob);
}
