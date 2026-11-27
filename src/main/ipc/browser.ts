import { BrowserWindow, dialog } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { BROWSER_ROUTES, type BrowserConnections } from '../../shared/browser';
import { BrowserChannels } from '../../shared/ipc_channels_definitions';
import { pollAutofill } from '../agent/tools/web/browser/autofill';
import { command } from '../agent/tools/web/browser/command';
import { findTab } from '../agent/tools/web/browser/find';
import { acting, pane, paneEvents, paneShown, paneTabs } from '../agent/tools/web/browser/pane';
import { workspaceScope } from '../workspaces/scope';
import { tabs } from '../agent/tools/web/browser/tabs';
import { profileFiles } from '../browser/files';
import { importFiles } from '../browser/import';
import { history } from '../browser/history';
import { library } from '../browser/library';
import { confirmDeletion } from '../browser/confirm';
import { bookmarksHtml } from '../browser/html';
import { loadTranslations } from '../i18n';
import { getAgentCursor, getLanguage, setAgentCursor } from '../settings_store';
import { fillLogin } from '../browser/fill';
import {
	clearLogins,
	countLogins,
	deleteLogin,
	importLogins,
	listLogins,
	matchLogins,
	neverSites,
	passwordsAvailable,
	setNever,
	updateLogin,
} from '../browser/passwords';
import { answerOffer } from '../agent/tools/web/browser/capture';
import { answerPermission } from '../agent/tools/web/browser/answer';
import { pass } from '../agent/tools/web/browser/pass';
import { answerDownload } from '../agent/tools/web/browser/release';
import { getPrivacy, privacyChanged } from '../privacy/state';
import { connections } from '../browser/connections';
import { acceptedProxy, HOST_PORT } from '../browser/proxy';
import { findTor } from '../browser/tor';
import { pickFiles } from '../browser/pick';
import { browserSources, foundProfiles } from '../browser/sources';
import { suggest } from '../browser/suggest';
import { wake } from '../browser/wake';
import type { AppRegistry } from '../apps/app_registry';
import type { EventBus } from '../event_bus';
import type { WindowContextManager } from '../window_context';
import type { IpcModule } from './core/module';
import { TrustedRenderer } from './core/trusted';

const targetId = z.string().regex(/^t\d+$/);
const edge = z.number().int().min(0).max(16_384);
const commandSchema = z.object({
	targetId: targetId.optional(),
	command: z.enum(['back', 'forward', 'reload', 'stop', 'navigate', 'focus', 'close', 'new', 'move']),
	url: z.string().max(4096).optional(),
	chat: z.string().min(1).max(256).optional(),
	index: z.number().int().min(0).max(10_000).optional(),
	route: z.enum(BROWSER_ROUTES).optional(),
});
function checkConnections(value: unknown): BrowserConnections {
	const { tor, proxy } = z.object({ tor: z.string().trim().max(300), proxy: z.string().trim().max(300) }).parse(value);
	if (tor && !HOST_PORT.test(tor)) throw new Error('Enter the Tor address as host:port, for example 127.0.0.1:9150.');
	if (proxy && !acceptedProxy(proxy)) throw new Error('Enter the proxy as socks5://host:port or http://host:port.');
	return { tor, proxy };
}
const viewSchema = z
	.object({ targetId, x: edge, y: edge, width: edge.min(1), height: edge.min(1) })
	.nullable();

const kindsSchema = z.object({ bookmarks: z.boolean(), history: z.boolean(), settings: z.boolean() });
const importSchema = kindsSchema.extend({ sources: z.array(z.string().max(64)).max(200) });
const pickSchema = kindsSchema.extend({ folder: z.boolean() });
const urlSchema = z.string().max(4096);
const placeSchema = z.object({ url: z.string().trim().max(4096), title: z.string().trim().max(1024) });
const loginChangeSchema = z.object({
	url: z.string().trim().min(1).max(4096),
	username: z.string().max(1024),
	password: z.string().max(4096),
});

export interface BrowserIpcDeps {
	windows: WindowContextManager;
	apps: AppRegistry;
}

export class BrowserIpc implements IpcModule<BrowserIpcDeps> {
	readonly name = 'browser';

	register({ windows, apps }: BrowserIpcDeps, _eventBus: EventBus): void {
		const trusted = new TrustedRenderer(windows, apps);
		const text = (): Record<string, string> =>
			(loadTranslations(getLanguage(), 'main') as unknown as { settings: { browser: Record<string, string> } })
				.settings.browser;

		// In-field password suggestions and offer-to-save: poll the visible tab's own focus while
		// the agent is not driving it, so the list follows the user, not the agent.
		setInterval(() => {
			for (const tab of new Set(paneShown.values()))
				if (tab.route === 'direct' && !tab.view.webContents.isDestroyed() && !(tab.chat && acting.has(tab.chat)))
					void workspaceScope.run(tab.workspace, () => pollAutofill(tab));
		}, 250).unref();

		paneEvents.on('change', () => trusted.broadcastScoped(BrowserChannels.changed, tabs));
		trusted.query(BrowserChannels.state, () => tabs());
		trusted.command(BrowserChannels.command, (request) => command(commandSchema.parse(request)));
		trusted.query(BrowserChannels.sources, () => browserSources());
		trusted.command(BrowserChannels.importData, (request) => {
			const chosen = importSchema.parse(request);
			const files = chosen.sources.flatMap((id) => {
				const directory = foundProfiles.get(id);
				return directory ? profileFiles(directory, chosen) : [];
			});
			return importFiles(files, chosen);
		});
		trusted.commandWithEvent(BrowserChannels.importPicked, async ({ sender }, request) => {
			const chosen = pickSchema.parse(request);
			const files = await pickFiles(BrowserWindow.fromWebContents(sender), chosen);
			return files && importFiles(files, chosen);
		});
		trusted.query(BrowserChannels.suggest, (text) => suggest(z.string().max(2048).parse(text)));
		trusted.query(BrowserChannels.bookmarks, () => library().bookmarks);
		trusted.command(BrowserChannels.bookmarksAdd, (place) => {
			const next = placeSchema.parse(place);
			if (!/^https?:\/\/[^/\s]+/i.test(next.url)) throw new Error('Only web pages can be bookmarked.');
			const current = library();
			if (current.bookmarks.some((item) => item.url === next.url)) return;
			library({ ...current, bookmarks: [...current.bookmarks, next] });
		});
		trusted.command(BrowserChannels.bookmarksUpdate, (url, place) => {
			const target = urlSchema.parse(url);
			const next = placeSchema.parse(place);
			if (!/^https?:\/\/[^/\s]+/i.test(next.url)) throw new Error('Enter a web address that starts with https://.');
			const current = library();
			if (next.url !== target && current.bookmarks.some((item) => item.url === next.url))
				throw new Error('That address is already bookmarked.');
			library({ ...current, bookmarks: current.bookmarks.map((item) => (item.url === target ? next : item)) });
		});
		trusted.command(BrowserChannels.bookmarksDelete, (url) => {
			const target = urlSchema.parse(url);
			const current = library();
			library({ ...current, bookmarks: current.bookmarks.filter((item) => item.url !== target) });
		});
		trusted.query(BrowserChannels.library, () => {
			const { bookmarks, search } = library();
			return { bookmarks: bookmarks.length, history: history().length, search };
		});
		trusted.query(BrowserChannels.history, () => history());
		trusted.command(BrowserChannels.historyDelete, (url) => {
			const target = urlSchema.parse(url);
			history(
				history().filter((item) => item.url !== target),
				true
			);
		});
		trusted.commandWithEvent(BrowserChannels.historyClear, async ({ sender }) => {
			const confirmed = await confirmDeletion(
				sender,
				text().clearHistoryConfirm.replace('{{count}}', String(history().length)),
				text().clearHistoryDetail
			);
			if (confirmed) history([], true);
			return confirmed;
		});
		trusted.commandWithEvent(BrowserChannels.bookmarksClear, async ({ sender }) => {
			const current = library();
			const confirmed = await confirmDeletion(
				sender,
				text().deleteBookmarksConfirm.replace('{{count}}', String(current.bookmarks.length)),
				text().deleteBookmarksDetail
			);
			if (confirmed) library({ ...library(), bookmarks: [] });
			return confirmed;
		});
		trusted.commandWithEvent(BrowserChannels.bookmarksExport, async ({ sender }) => {
			const window = BrowserWindow.fromWebContents(sender);
			const options = { defaultPath: 'bookmarks.html', filters: [{ name: 'HTML', extensions: ['html'] }] };
			const result = await (window ? dialog.showSaveDialog(window, options) : dialog.showSaveDialog(options));
			if (result.canceled || !result.filePath) return false;
			writeFileSync(result.filePath, bookmarksHtml(library().bookmarks));
			return true;
		});
		trusted.query(BrowserChannels.passwordsStatus, () => ({
			available: passwordsAvailable(),
			count: countLogins(),
		}));
		trusted.commandWithEvent(BrowserChannels.passwordsImport, async ({ sender }) => {
			const window = BrowserWindow.fromWebContents(sender);
			const options = {
				properties: ['openFile' as const],
				filters: [{ name: 'Passwords', extensions: ['csv'] }],
			};
			const result = await (window ? dialog.showOpenDialog(window, options) : dialog.showOpenDialog(options));
			if (result.canceled || !result.filePaths[0]) return null;
			return importLogins(readFileSync(result.filePaths[0], 'utf8'));
		});
		trusted.query(BrowserChannels.passwordsList, () => listLogins());
		trusted.commandWithEvent(BrowserChannels.passwordsClear, async ({ sender }) => {
			const confirmed = await confirmDeletion(
				sender,
				`Delete all ${countLogins()} saved passwords?`,
				'Every saved password is removed from this computer. This cannot be undone.'
			);
			if (confirmed) clearLogins();
			return confirmed;
		});
		trusted.command(BrowserChannels.passwordsOffer, (id, answer) => {
			const tab = findTab(targetId.parse(id));
			if (tab) answerOffer(tab, z.enum(['save', 'never', 'dismiss']).parse(answer));
		});
		trusted.query(BrowserChannels.passwordsNever, () => neverSites());
		trusted.command(BrowserChannels.passwordsNeverRemove, (site) => setNever(z.string().max(255).parse(site), false));
		trusted.command(BrowserChannels.passwordsUpdate, (loginId, change) =>
			updateLogin(z.string().max(64).parse(loginId), loginChangeSchema.parse(change))
		);
		trusted.commandWithEvent(BrowserChannels.passwordsDelete, async ({ sender }, loginId) => {
			const login = listLogins().find((item) => item.id === z.string().max(64).parse(loginId));
			if (!login) throw new Error('That saved password is no longer available.');
			const confirmed = await confirmDeletion(
				sender,
				`Delete the saved password for ${login.username || 'this login'}?`,
				`${login.url}\n\nThe password is removed from this computer. This cannot be undone.`
			);
			if (confirmed) deleteLogin(login.id);
			return confirmed;
		});
		// Saved passwords belong to direct tabs; private, Tor and proxy tabs never see them.
		trusted.command(BrowserChannels.passwordsMatch, (id) => {
			const tab = findTab(targetId.parse(id));
			return tab?.route === 'direct' ? matchLogins(tab.view.webContents.getURL()) : [];
		});
		trusted.command(BrowserChannels.passwordsFill, async (id, loginId) => {
			const tab = findTab(targetId.parse(id));
			if (!tab) throw new Error('This tab is closed.');
			if (tab.route !== 'direct') throw new Error('Saved passwords are not used in this tab.');
			await fillLogin(tab, z.string().max(64).parse(loginId));
		});
		trusted.command(BrowserChannels.downloadAnswer, (id, answer) => {
			const tab = findTab(targetId.parse(id));
			if (tab) answerDownload(tab, z.enum(['save', 'cancel', 'dismiss', 'show']).parse(answer));
		});
		trusted.command(BrowserChannels.permissionAnswer, (id, answer) => {
			const tab = findTab(targetId.parse(id));
			if (tab) answerPermission(tab, z.enum(['allow', 'block', 'dismiss']).parse(answer));
		});
		trusted.command(BrowserChannels.dangerContinue, (id) => {
			const tab = findTab(targetId.parse(id));
			if (tab) pass(tab);
		});
		trusted.query(BrowserChannels.connections, () => connections());
		trusted.command(BrowserChannels.connectionsSet, (value) => {
			connections(checkConnections(value));
			privacyChanged.emit('change', getPrivacy());
		});
		trusted.query(BrowserChannels.torFind, async () => (await findTor()) ?? null);
		trusted.query(BrowserChannels.cursor, () => getAgentCursor());
		trusted.command(BrowserChannels.cursorSet, (enabled) => setAgentCursor(z.boolean().parse(enabled)));
		trusted.commandWithEvent(BrowserChannels.view, ({ sender }, request) => {
			const next = viewSchema.parse(request);
			const tab = next ? findTab(next.targetId) : undefined;
			const window = BrowserWindow.fromWebContents(sender);
			const current = paneShown.get(sender);
			if (current && current !== tab && paneTabs.has(current.id)) current.view.setVisible(false);
			paneShown.delete(sender);
			if (!next || !tab || !window) return;
			pane.width = next.width;
			pane.height = next.height;
			if (tab.host !== window) {
				window.contentView.addChildView(tab.view);
				tab.host = window;
			}
			tab.view.setBounds({ x: next.x, y: next.y, width: next.width, height: next.height });
			tab.view.setVisible(true);
			paneShown.set(sender, tab);
			void wake(tab).catch(() => undefined);
		});
	}
}
