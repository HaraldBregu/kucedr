import { typedInvokeUnwrap } from '../shared/ipc_types';
import { McpChannels } from '../shared/ipc_channels_definitions';
import type { McpApi } from './index.d';
import type { McpSettings } from '../shared/mcp_types';

export const mcp: McpApi = {
	list: () => {
		return typedInvokeUnwrap(McpChannels.list);
	},
	get: (id: string) => {
		return typedInvokeUnwrap(McpChannels.get, id);
	},
	save: (input: McpSettings) => {
		return typedInvokeUnwrap(McpChannels.save, input);
	},
	upsert: (id, input) => {
		return typedInvokeUnwrap(McpChannels.upsert, id, input);
	},
	delete: (id: string) => {
		return typedInvokeUnwrap(McpChannels.delete, id);
	},
	registry: () => {
		return typedInvokeUnwrap(McpChannels.registry);
	},
	importLocal: () => {
		return typedInvokeUnwrap(McpChannels.importLocal);
	},
	configureLocal: (id, input) => {
		return typedInvokeUnwrap(McpChannels.configureLocal, id, input);
	},
	getRoot: () => {
		return typedInvokeUnwrap(McpChannels.getRoot);
	},
	openRoot: () => {
		return typedInvokeUnwrap(McpChannels.openRoot);
	},
	test: (id: string) => {
		return typedInvokeUnwrap(McpChannels.test, id);
	},
	oauthStatus: (id: string) => {
		return typedInvokeUnwrap(McpChannels.oauthStatus, id);
	},
	oauthStart: (id: string) => {
		return typedInvokeUnwrap(McpChannels.oauthStart, id);
	},
};
