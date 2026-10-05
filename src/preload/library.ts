import { typedInvokeUnwrap } from '../shared/ipc_types';
import { LibraryChannels } from '../shared/ipc_channels_definitions';
import type { LibraryApi } from './index.d';

export const library: LibraryApi = {
	list: () => typedInvokeUnwrap(LibraryChannels.list),
	add: (paths, destinationFolder) =>
		typedInvokeUnwrap(LibraryChannels.add, paths, destinationFolder),
	select: (destinationFolder) => typedInvokeUnwrap(LibraryChannels.select, destinationFolder),
	createFolder: (name, parent) => typedInvokeUnwrap(LibraryChannels.createFolder, name, parent),
	move: (relativePaths, destinationFolder) =>
		typedInvokeUnwrap(LibraryChannels.move, relativePaths, destinationFolder),
	download: (relativePaths) => typedInvokeUnwrap(LibraryChannels.download, relativePaths),
	delete: (relativePath) => typedInvokeUnwrap(LibraryChannels.delete, relativePath),
	openRoot: () => typedInvokeUnwrap(LibraryChannels.openRoot),
	getRoot: () => typedInvokeUnwrap(LibraryChannels.getRoot),
};
