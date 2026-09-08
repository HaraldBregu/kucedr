const invoke = jest.fn();
const on = jest.fn();
const removeListener = jest.fn();

jest.mock('electron', () => ({
	ipcRenderer: { invoke, on, removeListener },
}));

import { storage } from '../../../../src/preload/storage';
import { StorageChannels } from '../../../../src/shared/ipc_channels_definitions';
import type { StorageProviderInput } from '../../../../src/shared/storage_types';

beforeEach(() => {
	jest.clearAllMocks();
	invoke.mockResolvedValue({ success: true, data: [] });
});

it('queries operation status through the typed storage channel', async () => {
	await storage.getOperationStatus();

	expect(invoke).toHaveBeenCalledWith(StorageChannels.getOperationStatus);
});

it('subscribes and removes the exact operation status event handler', () => {
	const callback = jest.fn();
	const unsubscribe = storage.onOperationStatusChanged(callback);
	const handler = on.mock.calls[0][1];
	const status = { revision: 1 };

	handler({}, status);
	expect(callback).toHaveBeenCalledWith(status);
	unsubscribe();
	expect(removeListener).toHaveBeenCalledWith(StorageChannels.operationStatusChanged, handler);
});

it('exposes storage provider list, save and remove through typed channels', async () => {
	const input: StorageProviderInput = {
		name: 'Archive', endpoint: '', region: 'us-east-1', bucket: 'archive',
		accessKeyId: 'access-key', secretAccessKey: 'secret', forcePathStyle: false,
	};
	await storage.listProviders();
	await storage.saveProvider(input);
	await storage.removeProvider('connection');
	expect(invoke).toHaveBeenNthCalledWith(1, StorageChannels.listProviders);
	expect(invoke).toHaveBeenNthCalledWith(2, StorageChannels.saveProvider, input);
	expect(invoke).toHaveBeenNthCalledWith(3, StorageChannels.removeProvider, 'connection');
});

it('surfaces storage provider save failures to the renderer', async () => {
	invoke.mockResolvedValue({ success: false, error: { message: 'Secure storage is unavailable' } });
	await expect(storage.saveProvider({} as StorageProviderInput)).rejects.toThrow('Secure storage is unavailable');
});
