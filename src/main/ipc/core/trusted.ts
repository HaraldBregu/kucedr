import { BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { InvokeChannelMap } from '../../../shared/ipc_channels_types';
import type { AppRegistry } from '../../apps/app_registry';
import type { WindowContextManager } from '../../window_context';
import { workspaceScope } from '../../workspaces/scope';
import { senderWorkspace } from '../../workspaces/sender';
import { registerCommandWithEvent, registerQueryWithEvent } from './gateway';

export class TrustedRenderer {
	constructor(
		private readonly windows: WindowContextManager,
		private readonly apps: AppRegistry
	) {}

	assert(event: IpcMainInvokeEvent): BrowserWindow {
		if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) {
			throw new Error('Privileged IPC is restricted to the main frame.');
		}
		if (this.apps.has(event.sender)) {
			throw new Error('Privileged IPC is unavailable to app views.');
		}
		const window = BrowserWindow.fromWebContents(event.sender);
		if (!window || window.webContents !== event.sender || !this.windows.has(window.id)) {
			throw new Error('Privileged IPC is unavailable to this renderer.');
		}
		return window;
	}

	query<C extends keyof InvokeChannelMap>(
		channel: C,
		handler: (
			...args: InvokeChannelMap[C]['args']
		) => Promise<InvokeChannelMap[C]['result']> | InvokeChannelMap[C]['result']
	): void {
		registerQueryWithEvent(channel, (event, ...args) => {
			this.assert(event);
			return handler(...args);
		});
	}

	command<C extends keyof InvokeChannelMap>(
		channel: C,
		handler: (
			...args: InvokeChannelMap[C]['args']
		) => Promise<InvokeChannelMap[C]['result']> | InvokeChannelMap[C]['result']
	): void {
		registerCommandWithEvent(channel, (event, ...args) => {
			this.assert(event);
			return handler(...args);
		});
	}

	commandWithEvent<C extends keyof InvokeChannelMap>(
		channel: C,
		handler: (
			event: IpcMainInvokeEvent,
			...args: InvokeChannelMap[C]['args']
		) => Promise<InvokeChannelMap[C]['result']> | InvokeChannelMap[C]['result']
	): void {
		registerCommandWithEvent(channel, (event, ...args) => {
			this.assert(event);
			return handler(event, ...args);
		});
	}

	broadcastScoped(channel: string, data: () => unknown): void {
		BrowserWindow.getAllWindows().forEach((window) => {
			if (window.isDestroyed() || !this.windows.has(window.id)) return;
			const workspace = senderWorkspace(window.webContents);
			if (workspace) window.webContents.send(channel, workspaceScope.run(workspace, data));
		});
	}

	broadcast(channel: string, data: unknown): void {
		BrowserWindow.getAllWindows().forEach((window) => {
			if (!window.isDestroyed() && this.windows.has(window.id)) {
				window.webContents.send(channel, data);
			}
		});
	}
}
