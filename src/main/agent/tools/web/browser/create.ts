import { app, session, WebContentsView } from 'electron';
import { resetAutofill } from './autofill';
import { watchMouseButtons } from './buttons';
import { drop, readCapture } from './capture';
import { pane, paneEvents, paneTabs, type BrowserTab } from './pane';

const PARTITION = 'persist:agent-browser';
const CONSOLE_BUFFER_MAX = 100;
const FAVICON_MAX_BYTES = 200_000;
let prepared = false;

export function createTab(chat?: string, owner?: string): BrowserTab {
	if (!prepared) {
		prepared = true;
		const browsing = session.fromPartition(PARTITION);
		browsing.setUserAgent(
			browsing
				.getUserAgent()
				.split(' ')
				.filter((part) => !/^electron\//i.test(part) && !part.startsWith(`${app.getName()}/`))
				.join(' ')
		);
		browsing.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
		browsing.setPermissionCheckHandler(() => false);
		// ponytail: downloads are cancelled; hold and offer them when the network shield lands
		browsing.on('will-download', (event) => event.preventDefault());
	}
	const view = new WebContentsView({
		webPreferences: {
			partition: PARTITION,
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
		chat,
		owner,
		order: ++pane.order,
		position: ++pane.position,
	};
	const contents = view.webContents;
	const changed = (): void => {
		paneEvents.emit('change');
	};
	contents.debugger.attach('1.3');
	void contents.debugger
		.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true })
		.catch(() => undefined);
	contents.setWindowOpenHandler(({ url }) => {
		if (/^https?:/i.test(url))
			void createTab(tab.chat, tab.owner)
				.view.webContents.loadURL(url)
				.catch(() => undefined);
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
