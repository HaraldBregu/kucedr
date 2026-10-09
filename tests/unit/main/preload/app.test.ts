const invoke = jest.fn();
const on = jest.fn();
const removeListener = jest.fn();

jest.mock('electron', () => ({
	ipcRenderer: { invoke, on, removeListener },
	webUtils: { getPathForFile: jest.fn() },
}));

import { app } from '../../../../src/preload/app';
import { AppChannels } from '../../../../src/shared/ipc_channels_definitions';

it('reads launch state through the typed app channel', async () => {
	invoke.mockResolvedValue({
		success: true,
		data: { launchCount: 1, isFirstLaunch: true },
	});

	await expect(app.getLaunchState()).resolves.toEqual({ launchCount: 1, isFirstLaunch: true });
	expect(invoke).toHaveBeenCalledWith(AppChannels.getLaunchState);
});

it('reads daily activity through the typed app channel', async () => {
	invoke.mockResolvedValue({ success: true, data: [{ date: '2026-09-23', value: 12 }] });

	await expect(app.getActivity()).resolves.toEqual([{ date: '2026-09-23', value: 12 }]);
	expect(invoke).toHaveBeenCalledWith(AppChannels.getActivity);
});

it('reads and updates the sound feedback preference through typed app channels', async () => {
	invoke.mockResolvedValueOnce({ success: true, data: false });
	await expect(app.getSoundFeedbackEnabled()).resolves.toBe(false);
	expect(invoke).toHaveBeenCalledWith(AppChannels.getSoundFeedbackEnabled);

	invoke.mockResolvedValueOnce({ success: true, data: undefined });
	await app.setSoundFeedbackEnabled(true);
	expect(invoke).toHaveBeenCalledWith(AppChannels.setSoundFeedbackEnabled, true);
});

it('subscribes to sound feedback changes and removes the listener on cleanup', () => {
	const callback = jest.fn();
	const unsubscribe = app.onSoundFeedbackEnabledChanged(callback);
	const handler = on.mock.calls.find(
		([channel]) => channel === AppChannels.soundFeedbackEnabledChanged
	)?.[1];

	handler({}, false);
	expect(callback).toHaveBeenCalledWith(false);
	unsubscribe();
	expect(removeListener).toHaveBeenCalledWith(AppChannels.soundFeedbackEnabledChanged, handler);
});
