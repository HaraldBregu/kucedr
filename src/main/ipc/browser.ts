import { BrowserWindow, type WebContents } from 'electron';
import { z } from 'zod';
import { BrowserChannels } from '../../shared/ipc_channels_definitions';
import { command } from '../agent/tools/web/browser/command';
import { pane, paneEvents, paneTabs, type BrowserTab } from '../agent/tools/web/browser/pane';
import { tabs } from '../agent/tools/web/browser/tabs';
import type { AppRegistry } from '../apps/app_registry';
import type { EventBus } from '../event_bus';
import type { WindowContextManager } from '../window_context';
import type { IpcModule } from './core/module';
import { TrustedRenderer } from './core/trusted';

const targetId = z.string().regex(/^t\d+$/);
const edge = z.number().int().min(0).max(16_384);
const commandSchema = z.object({
	targetId,
	command: z.enum(['back', 'forward', 'reload', 'stop', 'navigate', 'focus']),
	url: z.string().max(4096).optional(),
});
const viewSchema = z
	.object({ targetId, x: edge, y: edge, width: edge.min(1), height: edge.min(1) })
	.nullable();

export interface BrowserIpcDeps {
	windows: WindowContextManager;
	apps: AppRegistry;
}

export class BrowserIpc implements IpcModule<BrowserIpcDeps> {
	readonly name = 'browser';

	register({ windows, apps }: BrowserIpcDeps, _eventBus: EventBus): void {
		const trusted = new TrustedRenderer(windows, apps);
		const shown = new Map<WebContents, BrowserTab>();

		paneEvents.on('change', () => trusted.broadcast(BrowserChannels.changed, tabs()));
		trusted.query(BrowserChannels.state, () => tabs());
		trusted.command(BrowserChannels.command, (request) => command(commandSchema.parse(request)));
		trusted.commandWithEvent(BrowserChannels.view, ({ sender }, request) => {
			const next = viewSchema.parse(request);
			const tab = next ? paneTabs.get(next.targetId) : undefined;
			const window = BrowserWindow.fromWebContents(sender);
			const current = shown.get(sender);
			if (current && current !== tab && paneTabs.has(current.id)) current.view.setVisible(false);
			shown.delete(sender);
			if (!next || !tab || !window) return;
			pane.width = next.width;
			pane.height = next.height;
			if (tab.host !== window) {
				window.contentView.addChildView(tab.view);
				tab.host = window;
			}
			tab.view.setBounds({ x: next.x, y: next.y, width: next.width, height: next.height });
			tab.view.setVisible(true);
			shown.set(sender, tab);
		});
	}
}
