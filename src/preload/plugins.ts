import { typedInvokeUnwrap } from '../shared/ipc_types';
import { PluginsChannels } from '../shared/ipc_channels_definitions';
import type { PluginsApi } from './index.d';

export const plugins: PluginsApi = {
	list: () => {
		return typedInvokeUnwrap(PluginsChannels.list);
	},
	installUrl: (url: string) => {
		return typedInvokeUnwrap(PluginsChannels.installUrl, url);
	},
	upload: (path) => {
		return typedInvokeUnwrap(PluginsChannels.upload, path);
	},
	remove: (id: string) => {
		return typedInvokeUnwrap(PluginsChannels.remove, id);
	},
	setEnabled: (id: string, enabled: boolean) => {
		return typedInvokeUnwrap(PluginsChannels.setEnabled, id, enabled);
	},
	listExtensions: () => {
		return typedInvokeUnwrap(PluginsChannels.listExtensions);
	},
	importExtensions: (paths) => {
		return typedInvokeUnwrap(PluginsChannels.importExtensions, paths);
	},
	removeExtension: (id: string) => {
		return typedInvokeUnwrap(PluginsChannels.removeExtension, id);
	},
};
