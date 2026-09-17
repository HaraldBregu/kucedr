import { typedInvokeUnwrap } from '../shared/ipc_types';
import { AppsChannels } from '../shared/ipc_channels_definitions';
import type { AppsApi } from './index.d';

export const apps: AppsApi = {
	getSettings: (appId) => typedInvokeUnwrap(AppsChannels.getSettings, appId),
	setSettings: (appId, settings) => typedInvokeUnwrap(AppsChannels.setSettings, appId, settings),
	list: () => {
		return typedInvokeUnwrap(AppsChannels.list);
	},
	open: (appId) => {
		return typedInvokeUnwrap(AppsChannels.open, appId);
	},
	openRoot: () => {
		return typedInvokeUnwrap(AppsChannels.openRoot);
	},
	delete: (appId) => {
		return typedInvokeUnwrap(AppsChannels.delete, appId);
	},
	import: () => {
		return typedInvokeUnwrap(AppsChannels.import);
	},
	addDebug: (folderPath) => {
		return typedInvokeUnwrap(AppsChannels.addDebug, folderPath);
	},
	selectDebugPath: () => {
		return typedInvokeUnwrap(AppsChannels.selectDebugPath);
	},
};
