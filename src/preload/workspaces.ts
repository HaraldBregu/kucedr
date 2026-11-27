import { WorkspacesChannels } from '../shared/ipc_channels_definitions';
import { typedInvokeUnwrap, typedOn } from '../shared/ipc_types';
import type { WorkspacesApi } from '../shared/workspaces_types';

export const workspaces: WorkspacesApi = {
	list: () => typedInvokeUnwrap(WorkspacesChannels.list),
	select: (id) => typedInvokeUnwrap(WorkspacesChannels.select, id),
	create: () => typedInvokeUnwrap(WorkspacesChannels.create),
	rename: (id, name) => typedInvokeUnwrap(WorkspacesChannels.rename, id, name),
	locate: (id) => typedInvokeUnwrap(WorkspacesChannels.locate, id),
	openWindow: (id) => typedInvokeUnwrap(WorkspacesChannels.openWindow, id),
	pickImage: (id) => typedInvokeUnwrap(WorkspacesChannels.pickImage, id),
	removeImage: (id) => typedInvokeUnwrap(WorkspacesChannels.removeImage, id),
	chats: (id) => typedInvokeUnwrap(WorkspacesChannels.chats, id),
	reveal: (id) => typedInvokeUnwrap(WorkspacesChannels.reveal, id),
	remove: (id) => typedInvokeUnwrap(WorkspacesChannels.remove, id),
	onChanged: (callback) => typedOn(WorkspacesChannels.changed, callback),
};
