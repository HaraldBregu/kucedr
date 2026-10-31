import { typedInvokeUnwrap } from '../shared/ipc_types';
import { ServicesChannels } from '../shared/ipc_channels_definitions';
import type { ServicesApi } from './index.d';

export const services: ServicesApi = {
	list: () => {
		return typedInvokeUnwrap(ServicesChannels.list);
	},
};
