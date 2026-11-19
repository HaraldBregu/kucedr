import { BrowserChannels } from '../shared/ipc_channels_definitions';
import { typedInvokeRaw, typedInvokeUnwrap, typedOn } from '../shared/ipc_types';
import type { BrowserPaneApi } from '../shared/browser';

export const browserPane: BrowserPaneApi = {
	state: () => typedInvokeUnwrap(BrowserChannels.state),
	command: (request) => typedInvokeUnwrap(BrowserChannels.command, request),
	view: (request) => void typedInvokeRaw(BrowserChannels.view, request),
	input: (request) => void typedInvokeRaw(BrowserChannels.input, request),
	onChanged: (callback) => typedOn(BrowserChannels.changed, callback),
	onFrame: (callback) => typedOn(BrowserChannels.frame, callback),
};
