import { randomUUID } from 'node:crypto';
import fs, { type FileHandle } from 'node:fs/promises';
import path from 'node:path';
import { BrowserWindow, type WebContents } from 'electron';
import type {
	RecordConfig,
	Recording,
	RecorderCaptureChunk,
	RecorderCaptureResult,
	RecorderCommand,
} from '../../shared/recorder_types';
import { isTrustedAppRendererUrl } from '../protocol';

const COMPLETION_GRACE_MS = 15_000;
const MAX_RECORDING_BYTES = 256 * 1024 * 1024;
const MAX_CHUNK_BYTES = 8 * 1024 * 1024;
const MAX_PENDING_CHUNKS = 8;

type RecordingWriter = {
	handle: FileHandle | null;
	chain: Promise<void>;
	nextSequence: number;
	pending: number;
	size: number;
	hasChunk: boolean;
};

export interface Recorder {
	start(config: RecordConfig): Recording;
	stop(id: string): void;
	cancel(id: string): void;
	chunk(chunk: RecorderCaptureChunk, senderId: number): Promise<void>;
	complete(result: RecorderCaptureResult, senderId: number): Promise<void>;
	destroy(): Promise<void>;
	get(id: string): Recording | undefined;
	list(): Recording[];
	waitFor(id: string): Promise<Recording>;
}

export function createRecorder(channels: { command: string; event: string }): Recorder {
	const recordings = new Map<string, Recording>();
	const waiters = new Map<string, Array<(recording: Recording) => void>>();
	const timeouts = new Map<string, NodeJS.Timeout>();
	const captureHosts = new Map<string, WebContents>();
	const writers = new Map<string, RecordingWriter>();

	function broadcast(channel: string, payload: unknown): void {
		BrowserWindow.getAllWindows().forEach((win) => {
			if (!win.isDestroyed()) win.webContents.send(channel, payload);
		});
	}

	function isActive(recording: Recording | undefined): recording is Recording {
		return (
			recording?.status === 'selecting' ||
			recording?.status === 'recording' ||
			recording?.status === 'stopping' ||
			recording?.status === 'saving'
		);
	}

	function set(recording: Recording): void {
		recordings.set(recording.id, recording);
		broadcast(channels.event, recording);
	}

	function sendCommand(id: string, command: RecorderCommand): void {
		const host = captureHosts.get(id);
		if (host && !host.isDestroyed()) host.send(channels.command, command);
	}

	function settle(recording: Recording): void {
		set(recording);
		const timer = timeouts.get(recording.id);
		if (timer) clearTimeout(timer);
		timeouts.delete(recording.id);
		captureHosts.delete(recording.id);
		const pending = waiters.get(recording.id);
		waiters.delete(recording.id);
		pending?.forEach((resolve) => resolve(recording));
	}

	async function closeWriter(id: string, removeFile: boolean): Promise<void> {
		const writer = writers.get(id);
		if (!writer) return;
		writers.delete(id);
		try {
			await writer.chain.catch(() => undefined);
		} finally {
			try {
				await writer.handle?.close();
			} finally {
				if (removeFile) {
					const recording = recordings.get(id);
					if (recording) await fs.rm(recording.url, { force: true });
				}
			}
		}
	}

	async function fail(id: string, error: unknown): Promise<void> {
		const recording = recordings.get(id);
		if (!isActive(recording)) return;
		const writer = writers.get(id);
		writers.delete(id);
		settle({
			...recording,
			status: 'error',
			error: error instanceof Error ? error.message : String(error),
		});
		try {
			await writer?.handle?.close();
		} finally {
			await fs.rm(recording.url, { force: true });
		}
	}

	async function openWriter(recording: Recording): Promise<FileHandle> {
		const writer = writers.get(recording.id);
		if (!writer) throw new Error('Recording writer is unavailable.');
		if (writer.handle) return writer.handle;
		await fs.mkdir(path.dirname(recording.url), { recursive: true });
		writer.handle = await fs.open(recording.url, 'wx');
		return writer.handle;
	}

	async function writeChunk(recording: Recording, chunk: RecorderCaptureChunk): Promise<void> {
		const writer = writers.get(recording.id);
		if (!writer) throw new Error('Recording writer is unavailable.');
		if (writer.size + chunk.data.byteLength > MAX_RECORDING_BYTES) {
			throw new Error('Recording data is too large.');
		}
		const handle = await openWriter(recording);
		let offset = 0;
		while (offset < chunk.data.byteLength) {
			const result = await handle.write(chunk.data, offset, chunk.data.byteLength - offset, null);
			if (result.bytesWritten <= 0) throw new Error('Recording output made no write progress.');
			offset += result.bytesWritten;
		}
		writer.size += chunk.data.byteLength;
		writer.hasChunk = true;
	}

	return {
		start(config) {
			const url = typeof config?.url === 'string' ? config.url.trim() : '';
			const duration = Number(config?.duration);
			if (!url || !path.isAbsolute(url)) {
				throw new Error('Recording url must be an absolute path.');
			}
			if (path.extname(url).toLowerCase() !== '.webm') {
				throw new Error('Recordings must use the .webm extension.');
			}
			if (!Number.isFinite(duration) || duration <= 0) {
				throw new Error('Recording duration must be a positive number of milliseconds.');
			}
			if ([...recordings.values()].some(isActive)) {
				throw new Error('A recording is already in progress.');
			}
			const captureWindow = BrowserWindow.getAllWindows().find(
				(window) => !window.isDestroyed() && isTrustedAppRendererUrl(window.webContents.getURL())
			);
			if (!captureWindow) {
				throw new Error('No app window is open to capture the recording.');
			}

			const recording: Recording = {
				id: randomUUID(),
				url,
				duration,
				status: 'selecting',
				startedAt: Date.now(),
			};
			captureHosts.set(recording.id, captureWindow.webContents);
			writers.set(recording.id, {
				handle: null,
				chain: Promise.resolve(),
				nextSequence: 0,
				pending: 0,
				size: 0,
				hasChunk: false,
			});
			set(recording);
			sendCommand(recording.id, { type: 'start', id: recording.id, duration });
			timeouts.set(
				recording.id,
				setTimeout(() => {
					const current = recordings.get(recording.id);
					if (isActive(current)) {
						sendCommand(recording.id, { type: 'cancel', id: recording.id });
						void fail(recording.id, 'Recording timed out.');
					}
				}, duration + COMPLETION_GRACE_MS)
			);
			return recording;
		},
		stop(id) {
			const recording = recordings.get(id);
			if (!recording || (recording.status !== 'recording' && recording.status !== 'selecting')) return;
			set({ ...recording, status: 'stopping' });
			sendCommand(id, { type: 'stop', id });
		},
		cancel(id) {
			const recording = recordings.get(id);
			if (!isActive(recording)) return;
			sendCommand(id, { type: 'cancel', id });
			settle({ ...recording, status: 'cancelled' });
			void closeWriter(id, true);
		},
		async chunk(chunk, senderId) {
			const recording = recordings.get(chunk?.id);
			if (!isActive(recording)) return;
			if (captureHosts.get(chunk.id)?.id !== senderId) {
				throw new Error('Recording chunk came from a different capture host.');
			}
			if (!(chunk.data instanceof Uint8Array) || chunk.data.byteLength === 0) {
				throw new Error('Recording chunk data is invalid.');
			}
			if (!Number.isSafeInteger(chunk.sequence) || chunk.sequence < 0) {
				throw new Error('Recording chunk sequence is invalid.');
			}
			if (chunk.data.byteLength > MAX_CHUNK_BYTES) {
				await fail(chunk.id, 'Recording chunk is too large.');
				return;
			}
			const writer = writers.get(chunk.id);
			if (!writer) throw new Error('Recording writer is unavailable.');
			if (chunk.sequence !== writer.nextSequence) {
				await fail(chunk.id, 'Recording chunks arrived out of order.');
				return;
			}
			if (writer.pending >= MAX_PENDING_CHUNKS) {
				await fail(chunk.id, 'Recording output cannot keep up with capture.');
				return;
			}
			writer.nextSequence += 1;
			writer.pending += 1;
			const operation = writer.chain.then(() => writeChunk(recording, chunk));
			writer.chain = operation.catch(async (error) => {
				await fail(chunk.id, error);
				throw error;
			});
			try {
				await operation;
			} finally {
				writer.pending -= 1;
			}
		},
		async complete(result, senderId) {
			const recording = recordings.get(result?.id);
			if (!isActive(recording)) return;
			if (captureHosts.get(result.id)?.id !== senderId) {
				throw new Error('Recording completion came from a different capture host.');
			}
			const writer = writers.get(result.id);
			if (result.error) {
				await writer?.chain.catch(() => undefined);
				if (isActive(recordings.get(result.id))) await fail(result.id, result.error);
				return;
			}
			if (!writer?.hasChunk) {
				fail(result.id, 'Recording produced no data.');
				return;
			}
			set({ ...recording, status: 'saving' });
			try {
				await writer.chain;
				const current = recordings.get(result.id);
				if (!current || !isActive(current)) return;
				await writer.handle?.close();
				writers.delete(result.id);
				settle({
					...current,
					status: 'completed',
					mimeType: result.mimeType,
					size: writer.size,
				});
			} catch (error) {
				await fail(result.id, error);
			}
		},
		async destroy() {
			const active = [...recordings.values()].filter(isActive);
			active.forEach((recording) => {
				sendCommand(recording.id, { type: 'cancel', id: recording.id });
				settle({ ...recording, status: 'cancelled' });
			});
			await Promise.all([...writers.keys()].map((id) => closeWriter(id, true)));
			timeouts.forEach((timer) => clearTimeout(timer));
			timeouts.clear();
		},
		get(id) {
			return recordings.get(id);
		},
		list() {
			return [...recordings.values()];
		},
		waitFor(id) {
			const recording = recordings.get(id);
			if (!recording) return Promise.reject(new Error(`Unknown recording: ${id}`));
			if (!isActive(recording)) return Promise.resolve(recording);
			return new Promise((resolve) => {
				waiters.set(id, [...(waiters.get(id) ?? []), resolve]);
			});
		},
	};
}
