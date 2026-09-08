const registerCommandWithEvent = jest.fn();
const registerQueryWithEvent = jest.fn();
const getStorageSettings = jest.fn();
const storageProviders = { list: jest.fn(), save: jest.fn(), remove: jest.fn() };

jest.mock('../../../../src/main/storage/providers', () => ({ storageProviders }));

jest.mock('../../../../src/main/ipc/core/gateway', () => ({
	registerCommandWithEvent,
	registerQueryWithEvent,
}));
jest.mock('../../../../src/main/storage', () => ({
	getStorageSettings,
	pickFolders: jest.fn(),
	pullFiles: jest.fn(),
	pushFiles: jest.fn(),
	rescheduleStorageSync: jest.fn(),
	saveStorageSettings: jest.fn(),
	syncFolders: jest.fn(),
	withStorageLock: jest.fn(),
}));

import { StorageIpc } from '../../../../src/main/ipc/storage';
import { StorageChannels } from '../../../../src/shared/ipc_channels_definitions';
import { BrowserWindow } from 'electron';

const appRegistry = { has: jest.fn() };
const windows = { has: jest.fn() };
const storageOperations = {
	getStatus: jest.fn(),
	isRunning: jest.fn(),
	backup: jest.fn(),
	restore: jest.fn(),
};
const mainFrame = {};
const sender = { id: 1, mainFrame };
const event = { sender, senderFrame: mainFrame };

beforeEach(() => {
	jest.clearAllMocks();
	appRegistry.has.mockReturnValue(false);
	windows.has.mockReturnValue(true);
	(BrowserWindow.fromWebContents as jest.Mock).mockReturnValue({ id: 1, webContents: sender });
	storageOperations.getStatus.mockReturnValue(undefined);
	storageOperations.isRunning.mockReturnValue(false);
	new StorageIpc().register(
		{
			appRegistry: appRegistry as never,
			storageOperations: storageOperations as never,
			windows: windows as never,
		},
		{} as never
	);
});

it('reads authoritative operation status and starts manual backups in main', () => {
	storageOperations.getStatus.mockReturnValue({ state: 'running' });
	storageOperations.backup.mockReturnValue({ state: 'running' });
	const query = registerQueryWithEvent.mock.calls.find(
		([channel]) => channel === StorageChannels.getOperationStatus
	)?.[1];
	const command = registerCommandWithEvent.mock.calls.find(
		([channel]) => channel === StorageChannels.backup
	)?.[1];

	expect(query(event)).toEqual({ state: 'running' });
	expect(command(event)).toEqual({ state: 'running' });
	expect(storageOperations.backup).toHaveBeenCalledWith('manual');
});

it('allows the app renderer to read storage sync settings', () => {
	getStorageSettings.mockReturnValue({ paths: [] });
	const handler = registerQueryWithEvent.mock.calls.find(
		([channel]) => channel === StorageChannels.getSettings
	)?.[1];
	expect(handler(event)).toEqual({ paths: [] });
});

it('rejects cloud storage access from app views', () => {
	appRegistry.has.mockReturnValue(true);
	const query = registerQueryWithEvent.mock.calls.find(
		([channel]) => channel === StorageChannels.getSettings
	)?.[1];
	const command = registerCommandWithEvent.mock.calls.find(
		([channel]) => channel === StorageChannels.backup
	)?.[1];
	expect(() => query(event)).toThrow('unavailable to app views');
	expect(() => command(event)).toThrow('unavailable to app views');
});

it('rejects untracked renderers', () => {
	(BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(null);
	const query = registerQueryWithEvent.mock.calls.find(
		([channel]) => channel === StorageChannels.getSettings
	)?.[1];

	expect(() => query(event)).toThrow('unavailable to this renderer');
	expect(getStorageSettings).not.toHaveBeenCalled();
});

it('lists, saves and removes storage providers through the trusted renderer', () => {
	const input = { name: 'Archive' };
	storageProviders.list.mockReturnValue([{ id: 'connection' }]);
	storageProviders.save.mockReturnValue({ id: 'connection' });
	storageProviders.remove.mockReturnValue(true);
	const list = registerQueryWithEvent.mock.calls.find(([channel]) => channel === StorageChannels.listProviders)?.[1];
	const save = registerCommandWithEvent.mock.calls.find(([channel]) => channel === StorageChannels.saveProvider)?.[1];
	const remove = registerCommandWithEvent.mock.calls.find(([channel]) => channel === StorageChannels.removeProvider)?.[1];
	expect(list(event)).toEqual([{ id: 'connection' }]);
	expect(save(event, input)).toEqual({ id: 'connection' });
	expect(remove(event, 'connection')).toBe(true);
	expect(storageProviders.save).toHaveBeenCalledWith(input);
	expect(storageProviders.remove).toHaveBeenCalledWith('connection');
});

it.each(['app view', 'untracked renderer', 'subframe'])('rejects provider credential access from an %s', (source) => {
	if (source === 'app view') appRegistry.has.mockReturnValue(true);
	if (source === 'untracked renderer') (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(null);
	const incoming = source === 'subframe' ? { ...event, senderFrame: {} } : event;
	for (const channel of [StorageChannels.listProviders, StorageChannels.saveProvider, StorageChannels.removeProvider]) {
		const handler = [...registerQueryWithEvent.mock.calls, ...registerCommandWithEvent.mock.calls].find(([name]) => name === channel)?.[1];
		expect(() => handler(incoming, {})).toThrow();
	}
	expect(storageProviders.list).not.toHaveBeenCalled();
	expect(storageProviders.save).not.toHaveBeenCalled();
	expect(storageProviders.remove).not.toHaveBeenCalled();
});
