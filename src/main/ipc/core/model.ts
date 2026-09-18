import type { IpcMainInvokeEvent } from 'electron';
import type { InvokeChannelMap } from '../../../shared/ipc_channels_types';
import type { AppRegistry } from '../../apps/app_registry';
import type { WindowContextManager } from '../../window_context';
import { registerCommandWithEvent, registerQueryWithEvent } from './gateway';
import { TrustedRenderer } from './trusted';

export class ModelRenderer {
	private readonly trusted: TrustedRenderer;

	constructor(
		windows: WindowContextManager,
		private readonly apps: AppRegistry
	) {
		this.trusted = new TrustedRenderer(windows, apps);
	}

	assert(event: IpcMainInvokeEvent): void {
		if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) {
			throw new Error('Model IPC is restricted to the main frame.');
		}
		if (this.apps.has(event.sender)) return;
		this.trusted.assert(event);
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
}
