import { act, renderHook } from '@testing-library/react';
import { useMediaRecorderTest } from '../../../src/renderer/src/pages/settings/pages/system/detail/recorder';
import type { SystemMedia } from '../../../src/renderer/src/pages/settings/pages/system/detail/media';

const track = { stop: jest.fn() };
const stream = {
	getTracks: () => [track],
	getVideoTracks: () => [],
} as unknown as MediaStream;

class FakeMediaRecorder {
	state: RecordingState = 'inactive';
	mimeType = 'audio/webm';
	ondataavailable: ((event: BlobEvent) => void) | null = null;
	onstop: (() => void) | null = null;

	start(): void {
		this.state = 'recording';
	}

	stop(): void {
		this.state = 'inactive';
		this.onstop?.();
	}
}

const media: SystemMedia = {
	id: 'microphone',
	titleKey: 'microphone',
	descriptionKey: 'microphone',
	source: 'user',
	constraints: { audio: true },
	video: false,
};

const screenMedia: SystemMedia = {
	id: 'screen',
	titleKey: 'screen',
	descriptionKey: 'screen',
	source: 'display',
	constraints: { video: true },
	video: true,
};

describe('useMediaRecorderTest', () => {
	let resolveStream: (value: MediaStream) => void;
	let getUserMedia: jest.Mock;
	let getDisplayMedia: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		window.app = {
			getMicrophoneInputId: jest.fn().mockResolvedValue('usb-microphone'),
		} as unknown as Window['app'];
		getUserMedia = jest.fn(
			() =>
				new Promise<MediaStream>((resolve) => {
					resolveStream = resolve;
				})
		);
		getDisplayMedia = jest.fn();
		Object.defineProperty(navigator, 'mediaDevices', {
			configurable: true,
			value: { getUserMedia, getDisplayMedia },
		});
		Object.defineProperty(window, 'MediaRecorder', {
			configurable: true,
			value: FakeMediaRecorder,
		});
	});

	it('coalesces concurrent starts into one capture request', async () => {
		const { result } = renderHook(() => useMediaRecorderTest(media));
		let first: Promise<void>;
		let second: Promise<void>;

		await act(async () => {
			first = result.current.start();
			second = result.current.start();
		});
		expect(result.current.state).toBe('starting');
		expect(getUserMedia).toHaveBeenCalledTimes(1);
		expect(getUserMedia).toHaveBeenCalledWith({ audio: { deviceId: { exact: 'usb-microphone' } } });

		await act(async () => {
			resolveStream(stream);
			await Promise.all([first, second]);
		});
		expect(result.current.state).toBe('recording');
	});

	it('stops a stream that resolves after unmount', async () => {
		const { result, unmount } = renderHook(() => useMediaRecorderTest(media));
		let pending: Promise<void>;

		await act(async () => {
			pending = result.current.start();
		});
		unmount();
		await act(async () => {
			resolveStream(stream);
			await pending;
		});

		expect(track.stop).toHaveBeenCalledTimes(1);
	});

	it('adds the selected microphone to a screen recording', async () => {
		const displayTracks: MediaStreamTrack[] = [
			{ kind: 'video', stop: jest.fn() } as MediaStreamTrack,
		];
		const microphoneTrack = { kind: 'audio', stop: jest.fn() } as MediaStreamTrack;
		const displayStream = {
			getTracks: () => displayTracks,
			getVideoTracks: () => displayTracks.filter((track) => track.kind === 'video'),
			getAudioTracks: () => displayTracks.filter((track) => track.kind === 'audio'),
			addTrack: (track: MediaStreamTrack) => displayTracks.push(track),
			removeTrack: (track: MediaStreamTrack) => {
				const index = displayTracks.indexOf(track);
				if (index >= 0) displayTracks.splice(index, 1);
			},
		} as unknown as MediaStream;
		const microphoneStream = {
			getTracks: () => [microphoneTrack],
			getAudioTracks: () => [microphoneTrack],
		} as unknown as MediaStream;
		getDisplayMedia.mockResolvedValue(displayStream);
		getUserMedia.mockResolvedValue(microphoneStream);

		const { result } = renderHook(() => useMediaRecorderTest(screenMedia));
		await act(async () => {
			await result.current.start();
		});

		expect(getUserMedia).toHaveBeenCalledWith({
			audio: {
				deviceId: { exact: 'usb-microphone' },
				echoCancellation: true,
				noiseSuppression: true,
			},
		});
		expect(displayStream.getAudioTracks()).toEqual([microphoneTrack]);
		expect(result.current.audioUnavailable).toBe(false);
		act(() => result.current.stop());
		expect(microphoneTrack.stop).toHaveBeenCalledTimes(1);
	});
});
