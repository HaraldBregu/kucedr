import type { IpcMainInvokeEvent } from 'electron';
import type { AppRegistry } from '../../apps/app_registry';
import type { WindowContextManager } from '../../window_context';
import { TrustedRenderer } from './trusted';

export class AgentRenderer {
	private readonly trusted: TrustedRenderer;

	constructor(
		windows: WindowContextManager,
		private readonly apps: AppRegistry
	) {
		this.trusted = new TrustedRenderer(windows, apps);
	}

	assert(event: IpcMainInvokeEvent): Electron.BrowserWindow {
		return this.trusted.assert(event);
	}

	assertWorkspace(event: IpcMainInvokeEvent): void {
		if (!this.apps.has(event.sender)) {
			this.trusted.assert(event);
			return;
		}
		if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) {
			throw new Error('Workspace IPC is restricted to the main frame.');
		}
		if (this.apps.resolve(event.sender) !== 'workspace' || !isBundledApp('workspace')) {
			throw new Error('Workspace IPC is unavailable to this app.');
		}
	}
}
