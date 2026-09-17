const invoke = jest.fn();

jest.mock('electron', () => ({ ipcRenderer: { invoke } }));

import { apps } from '../../../../src/preload/apps';
import { AppsChannels } from '../../../../src/shared/ipc_channels_definitions';
import { APP_WINDOW_DEFAULTS } from '../../../../src/shared/app_window_settings';

it('reads resolved settings for the selected app', async () => {
	invoke.mockResolvedValue({ success: true, data: APP_WINDOW_DEFAULTS });
	await expect(apps.getSettings('notes')).resolves.toEqual(APP_WINDOW_DEFAULTS);
	expect(invoke).toHaveBeenCalledWith(AppsChannels.getSettings, 'notes');
});

it('saves window preferences and sends an empty object to reset', async () => {
	const settings = { width: 960, resizable: false };
	const resolved = { ...APP_WINDOW_DEFAULTS, ...settings };
	invoke.mockResolvedValue({ success: true, data: resolved });
	await expect(apps.setSettings('notes', settings)).resolves.toEqual(resolved);
	expect(invoke).toHaveBeenCalledWith(AppsChannels.setSettings, 'notes', settings);
	await apps.setSettings('notes', {});
	expect(invoke).toHaveBeenLastCalledWith(AppsChannels.setSettings, 'notes', {});
});

it('surfaces settings validation and save failures', async () => {
	invoke.mockResolvedValue({ success: false, error: { code: 'INVALID_INPUT', message: 'Invalid app window settings.' } });
	await expect(apps.setSettings('notes', { width: -1 })).rejects.toThrow('Invalid app window settings.');
});

it('adds a debug app folder through the typed channel', async () => {
	invoke.mockResolvedValue({ success: true, data: undefined });
	await apps.addDebug('/projects/debug-app');
	expect(invoke).toHaveBeenCalledWith(AppsChannels.addDebug, '/projects/debug-app');
});
