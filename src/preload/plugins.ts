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
	available: () => {
		return typedInvokeUnwrap(PluginsChannels.available);
	},
	installCatalog: (id: string) => {
		return typedInvokeUnwrap(PluginsChannels.installCatalog, id);
	},
	remove: (id: string) => {
		return typedInvokeUnwrap(PluginsChannels.remove, id);
	},
	setEnabled: (id: string, enabled: boolean) => {
		return typedInvokeUnwrap(PluginsChannels.setEnabled, id, enabled);
	},
	getSettings: (id: string) => {
		return typedInvokeUnwrap(PluginsChannels.getSettings, id);
	},
	saveSettings: (id: string, values: Record<string, string>) => {
		return typedInvokeUnwrap(PluginsChannels.saveSettings, id, values);
	},
};
