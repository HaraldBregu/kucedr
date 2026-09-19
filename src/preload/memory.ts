import type { MemoryApi } from '../shared/memory_types';
import { MemoryChannels } from '../shared/ipc_channels_definitions';
import { typedInvokeUnwrap } from '../shared/ipc_types';
export const memory: MemoryApi = {
	getConfig: () => typedInvokeUnwrap(MemoryChannels.getConfig),
	configure: (patch) => typedInvokeUnwrap(MemoryChannels.configure, patch),
	refresh: () => typedInvokeUnwrap(MemoryChannels.refresh),
	status: () => typedInvokeUnwrap(MemoryChannels.status),
	list: () => typedInvokeUnwrap(MemoryChannels.list),
	read: () => typedInvokeUnwrap(MemoryChannels.read),
	edit: (markdown) => typedInvokeUnwrap(MemoryChannels.edit, markdown),
	forget: (id) => typedInvokeUnwrap(MemoryChannels.forget, id),
	clear: () => typedInvokeUnwrap(MemoryChannels.clear),
};
