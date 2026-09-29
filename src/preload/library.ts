import { typedInvokeUnwrap } from '../shared/ipc_types';
import { LibraryChannels } from '../shared/ipc_channels_definitions';
import type { LibraryApi } from './index.d';

export const library: LibraryApi = {
	list: () => typedInvokeUnwrap(LibraryChannels.list),
	openRoot: () => typedInvokeUnwrap(LibraryChannels.openRoot),
	getRoot: () => typedInvokeUnwrap(LibraryChannels.getRoot),
};
