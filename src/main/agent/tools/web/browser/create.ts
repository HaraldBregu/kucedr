import { session, WebContentsView } from 'electron';
import type { BrowserRoute } from '../../../../../shared/browser';
import { visit } from '../../../../browser/visit';
import { isPrivacyEnabled } from '../../../../privacy/state';
import { webrtc } from '../../../../shield/webrtc';
import { resetAutofill } from './autofill';
import { watchMouseButtons } from './buttons';
import { drop, readCapture } from './capture';
import { favicon } from './favicon';
import { answerPermission } from './answer';
import { acting, pane, paneEvents, paneTabs, type BrowserTab } from './pane';
import { prepare } from './prepare';
import { answerDownload } from './release';
import { currentWorkspace } from '../../../../workspaces/current';
import { workspaceScope } from '../../../../workspaces/scope';

const CONSOLE_BUFFER_MAX = 100;
let disposable = 0;

// Direct tabs share the profile with the user's logins. Every other tab gets its own in-memory
// profile (shared only with its popups), wiped when its last tab closes.
export function createTab(
	chat?: string,
	owner?: string,
	route: BrowserRoute = 'direct',
	partition = route === 'direct' ? currentWorkspace().partition : `${route}-${++disposable}`
): BrowserTab {
	const workspace = currentWorkspace();
	const prepared = prepare(partition, route);
	const view = new WebContentsView({
		webPreferences: {
			partition,
			sandbox: true,
			contextIsolation: true,
			nodeIntegration: false,
			...(route === 'tor' ? { disableBlinkFeatures: 'SharedWorker' } : {}),
		},
	});
	view.webContents.debugger.attach('1.3');
	const ready =
		route === 'tor'
			? Promise.all([prepared, disguise(view.webContents)]).then(() => undefined)
			: prepared;
	view.setBounds({ x: 0, y: 0, width: pane.width, height: pane.height });
	const tab: BrowserTab = {
		id: `t${pane.next++}`,
		view,
		logs: [],
		route,
		partition,
		ready,
		blocked: [],
		trackers: 0,
		chat,
		owner,
		agent: owner !== undefined,
		order: ++pane.order,
		position: ++pane.position,
		workspace,
	};
	const contents = view.webContents;
	const changed = (): void => {
		paneEvents.emit('change');
	};
	tab.ready.catch((error: unknown) => {
		tab.error = error instanceof Error ? error.message : String(error);
		changed();
	});
	contents.setWebRTCIPHandlingPolicy(webrtc(isPrivacyEnabled() || route === 'tor' || route === 'proxy'));
	void contents.debugger
		.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true })
		.catch(() => undefined);
	contents.setWindowOpenHandler(({ url }) => {
		if (/^https?:/i.test(url)) {
			const popup = workspaceScope.run(workspace, () =>
				createTab(tab.chat, tab.owner, route, partition)
			);
			popup.agent = tab.agent;
			const target = popup.view.webContents;
			void popup.ready
				.then(async () => {
					if (!target.isDestroyed()) await target.loadURL(url);
				})
				.catch(() => undefined);
		}
		return { action: 'deny' };
	});
	contents.on('will-navigate', (event, url) => {
		if (!/^https?:/i.test(url)) event.preventDefault();
	});
	contents.on('console-message', (event) => {
		if (workspaceScope.run(workspace, () => readCapture(tab, event.message))) return;
		tab.logs.push(`[${event.level}] ${event.message}`);
		if (tab.logs.length > CONSOLE_BUFFER_MAX) tab.logs.shift();
	});
	contents.on('did-start-navigation', (event) => {
		if (!event.isMainFrame || event.isSameDocument) return;
		tab.blocked.length = 0;
		tab.trackers = 0;
		tab.error = undefined;
		tab.icon = undefined;
		tab.pointer = undefined;
		tab.filled = false;
		resetAutofill(tab);
		changed();
	});
	contents.on('page-favicon-updated', (_event, icons) => {
		const icon = icons.find((candidate) => /^https?:|^data:/i.test(candidate));
		if (!icon) return;
		const page = contents.getURL();
		void tab.ready
			.then(() => (contents.isDestroyed() ? undefined : favicon(contents.session, icon)))
			.then((data) => {
				if (!data || contents.isDestroyed() || contents.getURL() !== page) return;
				tab.icon = data;
				changed();
			})
			.catch(() => undefined);
	});
	contents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
		if (!isMainFrame || code === -3) return;
		tab.error = description || `Error ${code}`;
		changed();
	});
	for (const name of [
		'did-start-loading',
		'did-stop-loading',
		'did-navigate',
		'did-navigate-in-page',
		'page-title-updated',
	] as const)
		contents.on(name as 'did-stop-loading', changed);
	// History keeps the user's own browsing in direct tabs only.
	const user = (): boolean => route === 'direct' && !(tab.chat && acting.has(tab.chat));
	const record = (url: string, title?: string): void =>
		workspaceScope.run(workspace, () => visit(url, title));
	contents.on('did-navigate', (_event, url) => {
		tab.granted = undefined;
		answerPermission(tab, 'dismiss');
		if (user()) record(url);
	});
	contents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
		if (isMainFrame && user()) record(url);
	});
	contents.on('page-title-updated', (_event, title) => {
		if (user()) record(contents.getURL(), title);
	});
	watchMouseButtons(contents);
	contents.once('destroyed', () => {
		drop(tab);
		paneTabs.delete(tab.id);
		if (tab.download?.state === 'asking') answerDownload(tab, 'cancel');
		answerPermission(tab, 'dismiss');
		if (route !== 'direct' && ![...paneTabs.values()].some((other) => other.partition === partition))
			void session.fromPartition(partition).clearData().catch(() => undefined);
		changed();
	});
	paneTabs.set(tab.id, tab);
	changed();
	return tab;
}
