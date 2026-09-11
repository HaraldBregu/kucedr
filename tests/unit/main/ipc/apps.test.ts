const listApps = jest.fn(() => []);
const loadApp = jest.fn();
const importApps = jest.fn();
const openRoot = jest.fn();
const deleteApp = jest.fn();
const destroyApp = jest.fn();
const writeAppWindowSettings = jest.fn();
const app = {
	id: 'demo-app',
	title: 'Demo App',
	description: 'A demo app.',
	metadata: { version: '1.0.0', category: 'Demo', entry: 'index.html' },
};

jest.mock('../../../../src/main/apps/app_index', () => ({
	listApps,
	loadApp,
	importApps,
	openRoot,
	deleteApp,
	destroyApp,
	writeAppWindowSettings,
}));
jest.mock('../../../../src/main/ipc/core/gateway', () => ({
	registerQueryWithEvent: jest.fn(),
	registerCommandWithEvent: jest.fn(),
}));

import type { EventBus } from '../../../../src/main/event_bus';
import { AppsIpc } from '../../../../src/main/ipc/apps';
import { registerCommandWithEvent, registerQueryWithEvent } from '../../../../src/main/ipc/core/gateway';
import { APP_WINDOW_DEFAULTS } from '../../../../src/shared/app_window_settings';
import type { WindowFactory } from '../../../../src/main/window_factory';
import { AppsChannels } from '../../../../src/shared/ipc_channels_definitions';
import { BrowserWindow, dialog } from 'electron';

beforeEach(() => {
	jest.clearAllMocks();
	listApps.mockReturnValue([app]);
	(dialog.showMessageBox as jest.Mock).mockResolvedValue({ response: 0, checkboxChecked: false });
});

const appRegistry = { has: jest.fn(() => false), revoke: jest.fn() };
const windows = { has: jest.fn(() => true) };
const mainFrame = {};
const sender = { mainFrame };
const event = { sender, senderFrame: mainFrame };
const owner = { id: 1, webContents: sender };

it('opens the apps directory in the system file explorer', () => {
	(BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(owner);
	new AppsIpc().register(
		{
			windowFactory: {} as WindowFactory,
			appRegistry: appRegistry as never,
			windows: windows as never,
		},
		{} as EventBus
	);

	const handler = (registerCommandWithEvent as jest.Mock).mock.calls.find(
		([channel]) => channel === AppsChannels.openRoot
	)?.[1];
	handler(event);

	expect(openRoot).toHaveBeenCalledTimes(1);
});

it('uses a native confirmation before deleting an app', async () => {
	(BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(owner);
	new AppsIpc().register(
		{
			windowFactory: {} as WindowFactory,
			appRegistry: appRegistry as never,
			windows: windows as never,
		},
		{} as EventBus
	);

	const deleteHandler = (registerCommandWithEvent as jest.Mock).mock.calls.find(
		([channel]) => channel === AppsChannels.delete
	)?.[1];

	await expect(deleteHandler(event, app.id)).resolves.toBe(false);
	expect(deleteApp).not.toHaveBeenCalled();
	expect(dialog.showMessageBox).toHaveBeenCalledWith(
		owner,
		expect.objectContaining({
			type: 'warning',
			buttons: ['Cancel', 'Delete App'],
			cancelId: 0,
			defaultId: 0,
			message: 'Delete “Demo App”?',
		})
	);

	(dialog.showMessageBox as jest.Mock).mockResolvedValueOnce({
		response: 1,
		checkboxChecked: false,
	});
	await expect(deleteHandler(event, app.id)).resolves.toBe(true);
	expect(deleteApp).toHaveBeenCalledTimes(1);
	expect(deleteApp).toHaveBeenCalledWith(app.id);
	expect(appRegistry.revoke).toHaveBeenCalledWith(app.id);
	expect(destroyApp).toHaveBeenCalledWith(app.id);

	await expect(deleteHandler(event, 'missing-app')).rejects.toThrow(
		'App not found: missing-app'
	);
});

describe('app window settings IPC', () => {
	let set: jest.Mock;
	let read: (event: unknown, id: string) => unknown;
	let save: (event: unknown, id: string, settings: unknown) => unknown;

	beforeEach(() => {
		appRegistry.has.mockReturnValue(false);
		windows.has.mockReturnValue(true);
		(BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(owner);
		set = writeAppWindowSettings;
		set.mockReturnValue({ ...APP_WINDOW_DEFAULTS, width: 960 });
		new AppsIpc().register({
			windowFactory: {} as WindowFactory,
			appRegistry: appRegistry as never,
			windows: windows as never,
		}, {} as EventBus);
		read = (registerQueryWithEvent as jest.Mock).mock.calls.find(([channel]) => channel === AppsChannels.getSettings)?.[1];
		save = (registerCommandWithEvent as jest.Mock).mock.calls.find(([channel]) => channel === AppsChannels.setSettings)?.[1];
	});

	it('reads and saves settings for a trusted renderer and installed app', () => {
		expect(read(event, app.id)).toEqual(APP_WINDOW_DEFAULTS);
		expect(save(event, app.id, { width: 960 })).toEqual({ ...APP_WINDOW_DEFAULTS, width: 960 });
		expect(set).toHaveBeenCalledWith(app.id, { width: 960 });
	});

	it('rejects missing app identifiers before accessing preferences', () => {
		expect(() => read(event, 'missing')).toThrow('App not found: missing');
		expect(() => save(event, 'missing', {})).toThrow('App not found: missing');
		expect(set).not.toHaveBeenCalled();
	});

	it('rejects embedded app views before accessing preferences', () => {
		appRegistry.has.mockReturnValue(true);
		expect(() => read(event, app.id)).toThrow('unavailable to app views');
		expect(() => save(event, app.id, {})).toThrow('unavailable to app views');
		expect(set).not.toHaveBeenCalled();
	});

	it('rejects subframes and unregistered windows', () => {
		const subframe = { ...event, senderFrame: {} };
		expect(() => read(subframe, app.id)).toThrow('restricted to the main frame');
		expect(() => save(subframe, app.id, {})).toThrow('restricted to the main frame');
		windows.has.mockReturnValue(false);
		expect(() => read(event, app.id)).toThrow('unavailable to this renderer');
		expect(() => save(event, app.id, {})).toThrow('unavailable to this renderer');
		expect(set).not.toHaveBeenCalled();
	});
});
