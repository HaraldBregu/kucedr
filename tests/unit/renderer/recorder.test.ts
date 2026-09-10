import { initRecorderCapture } from '../../../src/renderer/src/lib/recorder';

type Command = { type: 'start' | 'stop' | 'cancel'; id: string; duration?: number };

class FakeMediaRecorder {
	static instances: FakeMediaRecorder[] = [];
	static isTypeSupported = jest.fn(() => true);
	state: RecordingState = 'inactive';
	mimeType = 'video/webm';
	ondataavailable: ((event: { data: Blob }) => void) | null = null;
	onerror: (() => void) | null = null;
	onstop: (() => void) | null = null;

	constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {
		FakeMediaRecorder.instances.push(this);
	}

	start(): void {
		this.state = 'recording';
	}

	stop(): void {
		this.state = 'inactive';
		this.onstop?.();
	}

	emit(data: Blob): void {
		this.ondataavailable?.({ data });
	}
}

function createTrack(): MediaStreamTrack & { emitEnded: () => void } {
	const listeners = new Set<EventListener>();
	return {
		kind: 'video',
		readyState: 'live',
		stop: jest.fn(),
		addEventListener: (_type: string, listener: EventListener) => listeners.add(listener),
		removeEventListener: (_type: string, listener: EventListener) => listeners.delete(listener),
		emitEnded: () => listeners.forEach((listener) => listener(new Event('ended'))),
	} as never;
}

function createEnvironment() {
	const commands = new Map<string, (command: Command) => void>();
	const chunk = jest.fn(async () => undefined);
	const complete = jest.fn(async () => undefined);
	const streamTrack = createTrack();
	const microphoneTrack = { ...createTrack(), kind: 'audio' as const };
	const tracks: MediaStreamTrack[] = [streamTrack];
	const stream = {
		getTracks: () => tracks,
		getVideoTracks: () => [streamTrack],
		getAudioTracks: () => tracks.filter((track) => track.kind === 'audio'),
		addTrack: (track: MediaStreamTrack) => tracks.push(track),
		removeTrack: (track: MediaStreamTrack) => {
			const index = tracks.indexOf(track);
			if (index >= 0) tracks.splice(index, 1);
		},
	} as unknown as MediaStream;
	const microphone = {
		getTracks: () => [microphoneTrack],
		getAudioTracks: () => [microphoneTrack],
	} as unknown as MediaStream;
	const api = () => ({
		chunk,
		complete,
		onCommand: (callback: (command: Command) => void) => {
			commands.set(String(commands.size), callback);
			return () => undefined;
		},
		onEvent: () => () => undefined,
	});
	Object.assign(window, {
		recorder: { microphone: api(), camera: api(), screen: api() },
		app: { getMicrophoneInputId: jest.fn().mockResolvedValue('default') },
	});
	Object.assign(navigator, {
		mediaDevices: {
			getDisplayMedia: jest.fn(async () => stream),
			getUserMedia: jest.fn(async () => microphone),
		},
	});
	return { commands, chunk, complete, streamTrack, microphoneTrack, stream };
}

describe('renderer recorder capture', () => {
	beforeEach(() => {
		FakeMediaRecorder.instances = [];
		FakeMediaRecorder.isTypeSupported.mockReturnValue(true);
		Object.defineProperty(globalThis, 'MediaRecorder', {
			configurable: true,
			value: FakeMediaRecorder,
		});
	});

	it('streams final chunks before completion and stops when the source ends', async () => {
		const environment = createEnvironment();
		const dispose = initRecorderCapture();
		const start = environment.commands.get('2');
		start?.({ type: 'start', id: 'capture-1', duration: 30_000 });
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(FakeMediaRecorder.instances).toHaveLength(1);
		expect(environment.complete).not.toHaveBeenCalled();
		const recorder = FakeMediaRecorder.instances[0];
		recorder.emit({
			size: 5,
			arrayBuffer: async () => new Uint8Array([102, 105, 114, 115, 116]).buffer,
		} as Blob);
		environment.streamTrack.emitEnded();
		await new Promise((resolve) => setTimeout(resolve, 0));
		await Promise.resolve();

		expect(environment.chunk).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'capture-1', sequence: 0, data: expect.any(Uint8Array) })
		);
		expect(environment.complete).toHaveBeenCalledWith({ id: 'capture-1', mimeType: 'video/webm' });
		expect(environment.streamTrack.stop).toHaveBeenCalled();
		expect(environment.microphoneTrack.stop).toHaveBeenCalled();
		dispose();
	});

	it('keeps recording without a duration until it receives a stop command', async () => {
		const environment = createEnvironment();
		const dispose = initRecorderCapture();
		const command = environment.commands.get('2');
		command?.({ type: 'start', id: 'capture-1' });
		await new Promise((resolve) => setTimeout(resolve, 0));
		await new Promise((resolve) => setTimeout(resolve, 0));

		const recorder = FakeMediaRecorder.instances[0];
		expect(recorder.state).toBe('recording');

		command?.({ type: 'stop', id: 'capture-1' });
		expect(recorder.state).toBe('inactive');
		dispose();
	});

	it('cancels without sending a completion payload and rejects duplicate starts', async () => {
		const environment = createEnvironment();
		const dispose = initRecorderCapture();
		const start = environment.commands.get('2');
		start?.({ type: 'start', id: 'capture-1', duration: 30_000 });
		await new Promise((resolve) => setTimeout(resolve, 0));
		start?.({ type: 'start', id: 'capture-2', duration: 30_000 });
		await Promise.resolve();
		const cancel = environment.commands.get('2');
		cancel?.({ type: 'cancel', id: 'capture-1' });
		await Promise.resolve();

		expect(environment.complete).toHaveBeenCalledWith({
			id: 'capture-2',
			error: 'A recording is already in progress.',
		});
		expect(environment.complete).not.toHaveBeenCalledWith(
			expect.objectContaining({ id: 'capture-1' })
		);
		dispose();
	});
});
