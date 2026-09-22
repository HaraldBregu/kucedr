jest.mock('../../../../src/main/ipc/core/gateway', () => ({
	registerCommandWithEvent: jest.fn(),
	registerQueryWithEvent: jest.fn(),
}));

import type { IpcMainInvokeEvent } from 'electron';
import { registerAppStoreIpc } from '../../../../src/main/ipc/app_store';
import {
	registerCommandWithEvent,
	registerQueryWithEvent,
} from '../../../../src/main/ipc/core/gateway';
import { AppChannels } from '../../../../src/shared/ipc_channels_definitions';

describe('app store IPC', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('derives the namespace from the IPC sender', async () => {
		const appRegistry = {
			resolve: jest.fn((sender: { id: number }) => (sender.id === 7 ? 'draw' : 'demo')),
		};
		const appStorage = {
			get: jest.fn((_appId: string, key: string) => key),
			set: jest.fn(),
			delete: jest.fn(),
			readFile: jest.fn(async () => new Uint8Array([1])),
			writeFile: jest.fn(async () => undefined),
			deleteFile: jest.fn(async () => undefined),
		};
		registerAppStoreIpc({
			appRegistry: appRegistry as never,
			appStorage: appStorage as never,
		});

		const query = (channel: string) =>
			(registerQueryWithEvent as jest.Mock).mock.calls.find(([name]) => name === channel)?.[1];
		const command = (channel: string) =>
			(registerCommandWithEvent as jest.Mock).mock.calls.find(([name]) => name === channel)?.[1];
		const event = { sender: { id: 7 } } as IpcMainInvokeEvent;

		expect(query(AppChannels.getAppStoreValue)(event, 'config')).toBe('config');
		command(AppChannels.setAppStoreValue)(event, 'config', { ready: true });
		command(AppChannels.deleteAppStoreValue)(event, 'config');
		await expect(query(AppChannels.readAppStoreFile)(event, 'data.bin')).resolves.toEqual(
			new Uint8Array([1])
		);
		await command(AppChannels.writeAppStoreFile)(event, 'data.bin', new Uint8Array([2]));
		await command(AppChannels.deleteAppStoreFile)(event, 'data.bin');
		expect(appRegistry.resolve).toHaveBeenCalledWith(event.sender);
		expect(appStorage.get).toHaveBeenCalledWith('draw', 'config');
		expect(appStorage.set).toHaveBeenCalledWith('draw', 'config', { ready: true });
		expect(appStorage.delete).toHaveBeenCalledWith('draw', 'config');
		expect(appStorage.readFile).toHaveBeenCalledWith('draw', 'data.bin');
		expect(appStorage.writeFile).toHaveBeenCalledWith(
			'draw',
			'data.bin',
			new Uint8Array([2])
		);
		expect(appStorage.deleteFile).toHaveBeenCalledWith('draw', 'data.bin');
	});

	it('rejects senders that are not registered app views', () => {
		const appRegistry = {
			resolve: jest.fn(() => {
				throw new Error('App storage is only available to registered app views.');
			}),
		};
		registerAppStoreIpc({
			appRegistry: appRegistry as never,
			appStorage: {} as never,
		});
		const get = (registerQueryWithEvent as jest.Mock).mock.calls.find(
			([channel]) => channel === AppChannels.getAppStoreValue
		)?.[1];

		expect(() => get({ sender: { id: 1 } }, 'config')).toThrow('registered app views');
	});
});
