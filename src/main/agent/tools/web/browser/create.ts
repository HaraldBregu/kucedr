import { session, WebContentsView } from 'electron';
import type { BrowserRoute } from '../../../../../shared/browser';
import { resetAutofill } from './autofill';
import { watchMouseButtons } from './buttons';
import { drop, readCapture } from './capture';
import { visit } from '../../../../browser/visit';
import { acting, pane, paneEvents, paneTabs, type BrowserTab } from './pane';
import { prepare } from './prepare';

const PARTITION = 'persist:agent-browser';
const CONSOLE_BUFFER_MAX = 100;
const FAVICON_MAX_BYTES = 200_000;
let disposable = 0;

// Direct tabs share the profile with the user's logins. Every other tab gets its own in-memory
// profile (shared only with its popups), wiped when its last tab closes.
export function createTab(
	chat?: string,
	owner?: string,
	route: BrowserRoute = 'direct',
	partition = route === 'direct' ? PARTITION : `${route}-${++disposable}`
): BrowserTab {
	const view = new WebContentsView({
		webPreferences: {
			partition,
			sandbox: true,
			contextIsolation: true,
			nodeIntegration: false,
		},
	});
	view.setBounds({ x: 0, y: 0, width: pane.width, height: pane.height });
	const tab: BrowserTab = {
		id: `t${pane.next++}`,
		view,
		logs: [],
		route,
		partition,
		ready: prepare(partition, route),
		blocked: [],
		chat,
		owner,
		agent: owner !== undefined,
		order: ++pane.order,
		position: ++pane.position,
	};
	const contents = view.webContents;
	const changed = (): void => {
		paneEvents.emit('change');
	};
	tab.ready.catch((error: unknown) => {
		tab.error = error instanceof Error ? error.message : String(error);
		changed();
	});
	contents.setWebRTCIPHandlingPolicy(
		route === 'tor' || route === 'proxy' ? 'disable_non_proxied_udp' : 'default_public_interface_only'
	);
	contents.debugger.attach('1.3');
	void contents.debugger
		.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true })
		.catch(() => undefined);
	contents.setWindowOpenHandler(({ url }) => {
		if (/^https?:/i.test(url)) {
			const popup = createTab(tab.chat, tab.owner, route, partition);
			popup.agent = tab.agent;
			void popup.view.webContents.loadURL(url).catch(() => undefined);
		}
		return { action: 'deny' };
	});
	contents.on('will-navigate', (event, url) => {
		if (!/^https?:/i.test(url)) event.preventDefault();
	});
	contents.on('console-message', (event) => {
		if (readCapture(tab, event.message)) return;
		tab.logs.push(`[${event.level}] ${event.message}`);
		if (tab.logs.length > CONSOLE_BUFFER_MAX) tab.logs.shift();
	});
	contents.on('did-start-navigation', (event) => {
		if (!event.isMainFrame || event.isSameDocument) return;
		tab.blocked.length = 0;
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
		// The renderer's CSP serves https and data icons directly; http (localhost) icons it
		// blocks, so those are fetched in the browsing session and passed on as data.
		if (/^https:|^data:/i.test(icon)) {
			tab.icon = icon;
			changed();
			return;
		}
		const page = contents.getURL();
		void contents.session
			.fetch(icon)
			.then(async (response) => {
				const bytes = Buffer.from(await response.arrayBuffer());
				if (!response.ok || bytes.length > FAVICON_MAX_BYTES || contents.isDestroyed()) return;
				if (contents.getURL() !== page) return;
				const type = response.headers.get('content-type')?.split(';')[0] || 'image/x-icon';
				tab.icon = `data:${type};base64,${bytes.toString('base64')}`;
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
	const user = (): boolean => !(tab.chat && acting.has(tab.chat));
	contents.on('did-navigate', (_event, url) => {
		if (user()) visit(url);
	});
	contents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
		if (isMainFrame && user()) visit(url);
	});
	contents.on('page-title-updated', (_event, title) => {
		if (user()) visit(contents.getURL(), title);
	});
	watchMouseButtons(contents);
	contents.once('destroyed', () => {
		drop(tab);
		paneTabs.delete(tab.id);
		changed();
	});
	paneTabs.set(tab.id, tab);
	changed();
	return tab;
}
