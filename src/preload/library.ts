import { typedInvokeUnwrap } from '../shared/ipc_types';
import { LibraryChannels } from '../shared/ipc_channels_definitions';
import type { LibraryApi } from './index.d';

export const library: LibraryApi = {
	list: () => typedInvokeUnwrap(LibraryChannels.list),
	add: (paths) => typedInvokeUnwrap(LibraryChannels.add, paths),
	select: () => typedInvokeUnwrap(LibraryChannels.select),
	openRoot: () => typedInvokeUnwrap(LibraryChannels.openRoot),
	getRoot: () => typedInvokeUnwrap(LibraryChannels.getRoot),
};
