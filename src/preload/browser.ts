import { webFrame } from 'electron';
import { BrowserChannels } from '../shared/ipc_channels_definitions';
import { typedInvokeRaw, typedInvokeUnwrap, typedOn } from '../shared/ipc_types';
import type { BrowserPaneApi } from '../shared/browser';

export const browserPane: BrowserPaneApi = {
	state: () => typedInvokeUnwrap(BrowserChannels.state),
	command: (request) => typedInvokeUnwrap(BrowserChannels.command, request),
	view: (request) => {
		const zoom = webFrame.getZoomFactor();
		void typedInvokeRaw(
			BrowserChannels.view,
			request && {
				targetId: request.targetId,
				x: Math.round(request.x * zoom),
				y: Math.round(request.y * zoom),
				width: Math.round(request.width * zoom),
				height: Math.round(request.height * zoom),
			}
		);
	},
	onChanged: (callback) => typedOn(BrowserChannels.changed, callback),
	sources: () => typedInvokeUnwrap(BrowserChannels.sources),
	importData: (request) => typedInvokeUnwrap(BrowserChannels.importData, request),
	importPicked: (request) => typedInvokeUnwrap(BrowserChannels.importPicked, request),
	suggest: (text) => typedInvokeUnwrap(BrowserChannels.suggest, text),
	bookmarks: () => typedInvokeUnwrap(BrowserChannels.bookmarks),
	library: () => typedInvokeUnwrap(BrowserChannels.library),
	clearLibrary: () => typedInvokeUnwrap(BrowserChannels.clearLibrary),
	passwordsStatus: () => typedInvokeUnwrap(BrowserChannels.passwordsStatus),
	passwordsImport: () => typedInvokeUnwrap(BrowserChannels.passwordsImport),
	passwordsList: () => typedInvokeUnwrap(BrowserChannels.passwordsList),
	passwordsClear: () => typedInvokeUnwrap(BrowserChannels.passwordsClear),
	passwordsUpdate: (id, change) => typedInvokeUnwrap(BrowserChannels.passwordsUpdate, id, change),
	passwordsDelete: (id) => typedInvokeUnwrap(BrowserChannels.passwordsDelete, id),
	passwordsMatch: (targetId) => typedInvokeUnwrap(BrowserChannels.passwordsMatch, targetId),
	passwordsFill: (targetId, id) => typedInvokeUnwrap(BrowserChannels.passwordsFill, targetId, id),
};
