import { BrowserWindow, type WebContents } from 'electron';
import { z } from 'zod';
import { BrowserChannels } from '../../shared/ipc_channels_definitions';
import { command } from '../agent/tools/web/browser/command';
import { pane, paneEvents, paneTabs, type BrowserTab } from '../agent/tools/web/browser/pane';
import { tabs } from '../agent/tools/web/browser/tabs';
import { profileFiles } from '../browser/files';
import { importFiles } from '../browser/import';
import { DEFAULT_SEARCH, library } from '../browser/library';
import { pickFiles } from '../browser/pick';
import { browserSources, foundProfiles } from '../browser/sources';
import { suggest } from '../browser/suggest';
import type { AppRegistry } from '../apps/app_registry';
import type { EventBus } from '../event_bus';
import type { WindowContextManager } from '../window_context';
import type { IpcModule } from './core/module';
import { TrustedRenderer } from './core/trusted';

const targetId = z.string().regex(/^t\d+$/);
const edge = z.number().int().min(0).max(16_384);
const commandSchema = z.object({
	targetId,
	command: z.enum(['back', 'forward', 'reload', 'stop', 'navigate', 'focus', 'close', 'new']),
	url: z.string().max(4096).optional(),
});
const viewSchema = z
	.object({ targetId, x: edge, y: edge, width: edge.min(1), height: edge.min(1) })
	.nullable();

const importSchema = z.object({
	sources: z.array(z.string().max(200)).max(50),
	bookmarks: z.boolean(),
	history: z.boolean(),
	settings: z.boolean(),
});

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
		trusted.query(BrowserChannels.sources, () =>
			browserSources().map(({ id, browser, profile }) => ({ id, browser, profile }))
		);
		trusted.command(BrowserChannels.importData, (request) => importBrowserData(importSchema.parse(request)));
		trusted.query(BrowserChannels.suggest, (text) => suggest(z.string().max(2048).parse(text)));
		trusted.query(BrowserChannels.bookmarks, () => library().bookmarks);
		trusted.query(BrowserChannels.library, () => {
			const { bookmarks, history, search } = library();
			return { bookmarks: bookmarks.length, history: history.length, search };
		});
		trusted.command(BrowserChannels.clearLibrary, () => {
			library({ bookmarks: [], history: [], search: DEFAULT_SEARCH });
		});
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
