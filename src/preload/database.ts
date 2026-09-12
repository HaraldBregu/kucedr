import { typedInvokeUnwrap } from '../shared/ipc_types';
import { DatabaseChannels } from '../shared/ipc_channels_definitions';
import type { DatabaseApi } from './index.d';

export const database: DatabaseApi = {
	list: () => typedInvokeUnwrap(DatabaseChannels.list),
	getConfiguration: () => typedInvokeUnwrap(DatabaseChannels.getConfiguration),
	saveConfiguration: (configuration) =>
		typedInvokeUnwrap(DatabaseChannels.saveConfiguration, configuration),
};
