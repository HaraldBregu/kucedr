import { getMicrophoneConstraints } from './constraints';

export async function getScreenRecordingStream(
	constraints: MediaStreamConstraints,
	sourceId?: string
): Promise<{ stream: MediaStream; hasMicrophone: boolean }> {
	const stream = sourceId
		? await navigator.mediaDevices.getUserMedia({
			video: {
				mandatory: {
					chromeMediaSource: 'desktop',
					chromeMediaSourceId: sourceId,
				},
			},
		} as MediaStreamConstraints)
		: await navigator.mediaDevices.getDisplayMedia(constraints);
	let microphone: MediaStream | null = null;
	try {
		microphone = await navigator.mediaDevices.getUserMedia({
			audio: await getMicrophoneConstraints({ echoCancellation: true, noiseSuppression: true }),
		});
		const tracks = microphone.getAudioTracks();
		tracks.forEach((track) => stream.addTrack(track));
		return { stream, hasMicrophone: tracks.length > 0 };
	} catch {
		microphone?.getTracks().forEach((track) => {
			stream.removeTrack(track);
			track.stop();
		});
		return { stream, hasMicrophone: false };
	}
}
