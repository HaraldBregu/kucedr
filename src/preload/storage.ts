import { typedInvokeUnwrap, typedOn } from '../shared/ipc_types';
import { StorageChannels } from '../shared/ipc_channels_definitions';
import type { StorageApi } from './index.d';

export const storage: StorageApi = {
	listProviders: () => typedInvokeUnwrap(StorageChannels.listProviders),
	saveProvider: (input) => typedInvokeUnwrap(StorageChannels.saveProvider, input),
	removeProvider: (id) => typedInvokeUnwrap(StorageChannels.removeProvider, id),
	getSettings: () => typedInvokeUnwrap(StorageChannels.getSettings),
	saveSettings: (settings) => typedInvokeUnwrap(StorageChannels.saveSettings, settings),
	syncFolders: () => typedInvokeUnwrap(StorageChannels.syncFolders),
	pickFolders: () => typedInvokeUnwrap(StorageChannels.pickFolders),
	getOperationStatus: () => typedInvokeUnwrap(StorageChannels.getOperationStatus),
	onOperationStatusChanged: (callback) => typedOn(StorageChannels.operationStatusChanged, callback),
	backup: () => typedInvokeUnwrap(StorageChannels.backup),
	restore: () => typedInvokeUnwrap(StorageChannels.restore),
};
