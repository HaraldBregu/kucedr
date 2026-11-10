import { typedInvokeUnwrap } from '../shared/ipc_types';
import { ScriptsChannels } from '../shared/ipc_channels_definitions';
import type { ScriptsApi } from './index.d';

export const scripts: ScriptsApi = {
	list: () => {
		return typedInvokeUnwrap(ScriptsChannels.list);
	},
	render: (name: string, input: unknown, theme: 'light' | 'dark') => {
		return typedInvokeUnwrap(ScriptsChannels.render, name, input, theme);
	},
	getSettings: (name: string) => {
		return typedInvokeUnwrap(ScriptsChannels.getSettings, name);
	},
	saveSettings: (name: string, values: Record<string, string>) => {
		return typedInvokeUnwrap(ScriptsChannels.saveSettings, name, values);
	},
};
