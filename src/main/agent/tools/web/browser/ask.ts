import type { Session } from 'electron';
import type { BrowserRoute } from '../../../../../shared/browser';
import { answerPermission } from './answer';
import { tabFor } from './owner';
import { paneEvents, sitePermits } from './pane';
import { uses } from './uses';

type Handler = NonNullable<Parameters<Session['setPermissionRequestHandler']>[0]>;

// Camera, microphone, location and notification requests wait for the user's answer in the pane,
// unless the site already has one for this session. Anything else, and anything in a Tor tab, is
// denied without asking.
export function askPermission(partition: string, route: BrowserRoute): Handler {
	return (contents, permission, callback, details) => {
		const kinds = uses(permission, 'mediaTypes' in details ? details.mediaTypes : undefined);
		const tab = tabFor(contents);
		if (!kinds.length || route === 'tor' || !tab || !/^https?:/i.test(details.requestingUrl)) return callback(false);
		const origin = new URL(details.requestingUrl).origin;
		const saved = kinds.map((kind) => sitePermits.get(`${partition} ${origin} ${kind}`));
		if (saved.includes(false)) return callback(false);
		if (saved.every(Boolean)) return callback(true);
		answerPermission(tab, 'dismiss');
		tab.permission = { site: new URL(origin).host, kinds, origin, answer: callback };
		paneEvents.emit('change');
	};
}
