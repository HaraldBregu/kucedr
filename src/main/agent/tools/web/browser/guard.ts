import type { Session } from 'electron';
import type { BrowserBlocked } from '../../../../../shared/browser';
import { rebound } from '../../../../shield/rebound';
import { strip } from '../../../../shield/strip';
import { thirdParty } from '../../../../shield/third_party';
import { verdict } from '../../../../shield/verdict';
import { block } from './block';
import { tabFor } from './owner';
import { acting } from './pane';

// The network shield for one tab session: every request is checked before it leaves. Nothing
// leaves before the session's connection is in place, or when a check cannot run. A page load
// that carries tracking parameters goes to the same address without them. Third-party requests
// carry no cookies and cannot set any.
export function guard(browsing: Session, routed: boolean, open: () => boolean): void {
	browsing.webRequest.onBeforeRequest((details, callback) => {
		let reason: BrowserBlocked['reason'] | undefined;
		let redirectURL: string | undefined;
		try {
			reason = open() ? verdict(details, routed, details.webContents?.getURL()) : 'route';
			const tab = reason === 'dangerous' ? tabFor(details.webContents) : undefined;
			if (tab?.passed?.has(new URL(details.url).hostname) && !(tab.chat && acting.has(tab.chat))) reason = undefined;
			if (!reason && details.resourceType === 'mainFrame' && details.method === 'GET') redirectURL = strip(details.url);
		} catch {
			reason = 'route';
		}
		const deny = (why: BrowserBlocked['reason']): void => {
			const tab = tabFor(details.webContents);
			if (tab && why === 'dangerous' && details.resourceType === 'mainFrame') tab.danger = details.url;
			if (tab) block(tab, details.url, why);
			callback({ cancel: true });
		};
		const allow = (): void => callback(redirectURL ? { redirectURL } : { cancel: false });
		if (reason) return deny(reason);
		if (routed) return allow();
		rebound(browsing, details).then(
			(local) => (local ? deny('local') : allow()),
			() => deny('route')
		);
	});
	const foreign = (details: Electron.OnBeforeSendHeadersListenerDetails | Electron.OnHeadersReceivedListenerDetails): boolean =>
		details.resourceType !== 'mainFrame' && thirdParty(new URL(details.url).hostname, details.webContents?.getURL());
	const without = <T extends Record<string, unknown>>(headers: T, name: string): T =>
		Object.fromEntries(Object.entries(headers).filter(([key]) => key.toLowerCase() !== name)) as T;
	browsing.webRequest.onBeforeSendHeaders((details, callback) =>
		callback({ requestHeaders: foreign(details) ? without(details.requestHeaders, 'cookie') : details.requestHeaders })
	);
	browsing.webRequest.onHeadersReceived((details, callback) =>
		callback(
			foreign(details) && details.responseHeaders
				? { responseHeaders: without(details.responseHeaders, 'set-cookie') }
				: {}
		)
	);
}
