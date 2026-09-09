export async function getMicrophoneInputs(): Promise<{
	inputs: MediaDeviceInfo[];
	currentInput: MediaDeviceInfo | null;
}> {
	const devices = await navigator.mediaDevices.enumerateDevices();
	const audioInputs = devices.filter((device) => device.kind === 'audioinput' && device.deviceId);
	const inputs = audioInputs.filter(
		(device) => device.deviceId !== 'default' && device.deviceId !== 'communications'
	);
	const systemDefault = audioInputs.find((device) => device.deviceId === 'default');
	const currentInput = systemDefault
		? (inputs.find((device) => device.groupId && device.groupId === systemDefault.groupId) ??
			systemDefault)
		: null;
	return { inputs, currentInput };
}
