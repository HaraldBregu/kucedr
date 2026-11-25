import type { Session } from 'electron';
import type { BrowserRoute } from '../../../../../shared/browser';
import { answerPermission } from './answer';
import { tabFor } from './owner';
import { acting, paneEvents } from './pane';
import { uses } from './uses';

type Handler = NonNullable<Parameters<Session['setPermissionRequestHandler']>[0]>;

// Camera and microphone requests from a page the user browses wait for the user's answer in the
// pane, unless the user already allowed that origin on this page. Anything else, anything in a Tor
// tab or a tab the agent opened or drives, and any request from a frame is denied without asking.
export function askPermission(route: BrowserRoute): Handler {
	return (contents, permission, callback, details) => {
		const kinds = uses(permission, 'mediaTypes' in details ? details.mediaTypes : undefined);
		const tab = tabFor(contents);
		if (
			!kinds.length ||
			route === 'tor' ||
			!tab?.chat ||
			tab.agent ||
			acting.has(tab.chat) ||
			!details.isMainFrame ||
			!/^https?:/i.test(details.requestingUrl)
		)
			return callback(false);
		const origin = new URL(details.requestingUrl).origin;
		if (kinds.every((kind) => tab.granted?.has(`${origin} ${kind}`))) return callback(true);
		const earlier = tab.permission?.origin === origin ? tab.permission : undefined;
		if (!earlier) answerPermission(tab, 'dismiss');
		tab.permission = {
			site: new URL(origin).host,
			kinds: [...new Set([...(earlier?.kinds ?? []), ...kinds])],
			origin,
			answer: (allowed) => {
				earlier?.answer(allowed);
				callback(allowed);
			},
		};
		paneEvents.emit('change');
	};
}
