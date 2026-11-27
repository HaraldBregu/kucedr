import type { BrowserBlocked } from '../../../../../shared/browser';
import { paneEvents, type BrowserTab } from './pane';

const BLOCKED_MAX = 50;
const URL_MAX = 300;

export function block(tab: BrowserTab, url: string, reason: BrowserBlocked['reason']): void {
	// The address of a request stopped for carrying a key would show the key; keep only its site.
	const shown =
		(reason === 'secret' || reason === 'tracker') && URL.canParse(url) ? new URL(url).origin : url.slice(0, URL_MAX);
	if (reason === 'tracker') tab.trackers++;
	if (reason !== 'tracker' || !tab.blocked.some((item) => item.reason === reason && item.url === shown))
		tab.blocked.push({ url: shown, reason });
	if (tab.blocked.length > BLOCKED_MAX) tab.blocked.shift();
	paneEvents.emit('change');
}
