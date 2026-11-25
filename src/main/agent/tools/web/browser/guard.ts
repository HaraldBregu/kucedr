import type { Session } from 'electron';
import type { BrowserBlocked } from '../../../../../shared/browser';
import { verdict } from '../../../../shield/verdict';
import { block } from './block';
import { hygiene } from './hygiene';
import { tabFor } from './owner';

// The network shield for one tab session: every request is checked before it leaves. Nothing
// leaves before the session's connection is in place, or when a check cannot run.
export function guard(browsing: Session, routed: boolean, open: () => boolean): void {
	const tidy = hygiene(browsing);
	browsing.webRequest.onBeforeRequest((details, callback) => {
		let reason: BrowserBlocked['reason'] | undefined;
		try {
			reason = open() ? verdict(details, routed) : 'route';
		} catch {
			reason = 'route';
		}
		if (reason) {
			const tab = tabFor(details.webContents);
			if (tab) block(tab, details.url, reason);
		}
		callback({ cancel: reason !== undefined });
	});
}
