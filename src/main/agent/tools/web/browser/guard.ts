import type { Session } from 'electron';
import type { BrowserBlocked } from '../../../../../shared/browser';
import { rebound } from '../../../../shield/rebound';
import { strip } from '../../../../shield/strip';
import { verdict } from '../../../../shield/verdict';
import { block } from './block';
import { tabFor } from './owner';

// The network shield for one tab session: every request is checked before it leaves. Nothing
// leaves before the session's connection is in place, or when a check cannot run. A page load
// that carries tracking parameters goes to the same address without them.
export function guard(browsing: Session, routed: boolean, open: () => boolean): void {
	browsing.webRequest.onBeforeRequest((details, callback) => {
		let reason: BrowserBlocked['reason'] | undefined;
		let redirectURL: string | undefined;
		try {
			reason = open() ? verdict(details, routed, details.webContents?.getURL()) : 'route';
			if (!reason && details.resourceType === 'mainFrame' && details.method === 'GET') redirectURL = strip(details.url);
		} catch {
			reason = 'route';
		}
		const deny = (why: BrowserBlocked['reason']): void => {
			const tab = tabFor(details.webContents);
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
}
