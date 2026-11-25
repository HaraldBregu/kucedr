import type { OnBeforeRequestListenerDetails, Session, WebContents, WebFrameMain } from 'electron';
import { foreign } from '../../../../shield/foreign';
import { tidy } from '../../../../shield/tidy';

function top(frame: WebFrameMain | null | undefined, contents: WebContents | undefined): string {
	try {
		return frame?.top?.url ?? contents?.getURL() ?? '';
	} catch {
		return contents?.getURL() ?? '';
	}
}

// Browsing hygiene for one tab session: third parties get no cookies, and top-level loads go over
// HTTPS first, falling back to http for a host whose HTTPS fails or sends the page back to http.
// Returns where a request should go instead, or undefined.
// ponytail: cookies are stripped from headers only; a third-party frame's own script can still
// use document.cookie. No 3 s fallback timer as in Chrome, so a host whose HTTPS port drops
// packets waits for the connection timeout before the http retry.
export function hygiene(browsing: Session): (details: OnBeforeRequestListenerDetails) => string | undefined {
	const plain = new Set<string>();
	const upgraded = new Map<number, string>();
	browsing.webRequest.onBeforeSendHeaders((details, callback) => {
		if (details.resourceType === 'mainFrame' || !foreign(details.url, top(details.frame, details.webContents)))
			return callback({});
		const requestHeaders = { ...details.requestHeaders };
		for (const name of Object.keys(requestHeaders)) if (name.toLowerCase() === 'cookie') delete requestHeaders[name];
		callback({ requestHeaders });
	});
	browsing.webRequest.onHeadersReceived((details, callback) => {
		if (
			!details.responseHeaders ||
			details.resourceType === 'mainFrame' ||
			!foreign(details.url, top(details.frame, details.webContents))
		)
			return callback({});
		const responseHeaders = { ...details.responseHeaders };
		for (const name of Object.keys(responseHeaders)) if (name.toLowerCase() === 'set-cookie') delete responseHeaders[name];
		callback({ responseHeaders });
	});
	browsing.webRequest.onBeforeRedirect((details) => {
		if (details.resourceType !== 'mainFrame' || !URL.canParse(details.redirectURL)) return;
		const from = new URL(details.url);
		const to = new URL(details.redirectURL);
		if (from.protocol === 'https:' && to.protocol === 'http:' && from.hostname === to.hostname) plain.add(to.hostname);
	});
	browsing.webRequest.onErrorOccurred((details) => {
		if (details.resourceType !== 'mainFrame' || details.webContentsId === undefined) return;
		if (upgraded.get(details.webContentsId) !== details.url) return;
		upgraded.delete(details.webContentsId);
		if (details.error === 'net::ERR_ABORTED' || details.error === 'net::ERR_BLOCKED_BY_CLIENT') return;
		const url = new URL(details.url);
		url.protocol = 'http:';
		plain.add(url.hostname);
		void details.webContents?.loadURL(url.href).catch(() => undefined);
	});
	return (details) => {
		if (details.resourceType !== 'mainFrame' || details.method !== 'GET') return undefined;
		const next = tidy(details.url, plain);
		if (next === details.url) return undefined;
		if (details.webContentsId !== undefined && details.url.startsWith('http:') && next.startsWith('https:'))
			upgraded.set(details.webContentsId, next);
		return next;
	};
}
