import { DataChannels } from '../shared/ipc_channels_definitions';
import { typedInvokeUnwrap } from '../shared/ipc_types';
import type { DataApi } from '../shared/data_types';

export const data: DataApi = {
	listScopes: () => typedInvokeUnwrap(DataChannels.listScopes),
	getStorageUsage: () => typedInvokeUnwrap(DataChannels.getStorageUsage),
	export: (scope) => typedInvokeUnwrap(DataChannels.export, scope),
	exportAll: () => typedInvokeUnwrap(DataChannels.exportAll),
	previewPurge: (scope) => typedInvokeUnwrap(DataChannels.previewPurge, scope),
	purge: (scope, confirmationId) =>
		typedInvokeUnwrap(DataChannels.purge, scope, confirmationId),
	getChatRetention: () => typedInvokeUnwrap(DataChannels.getChatRetention),
	setChatRetention: (days) => typedInvokeUnwrap(DataChannels.setChatRetention, days),
};
