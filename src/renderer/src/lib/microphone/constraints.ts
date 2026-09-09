export async function getMicrophoneConstraints(
	constraints: MediaTrackConstraints = {}
): Promise<MediaTrackConstraints> {
	const inputId = await window.app.getMicrophoneInputId();
	return inputId === 'default' ? constraints : { ...constraints, deviceId: { exact: inputId } };
}
