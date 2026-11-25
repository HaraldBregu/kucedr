import { paneEvents, sitePermits, type BrowserTab } from './pane';

// Allow and Block are kept for the tab's session until Kucedr quits; closing the bar denies this
// request only.
export function answerPermission(tab: BrowserTab, answer: 'allow' | 'block' | 'dismiss'): void {
	const request = tab.permission;
	if (!request) return;
	tab.permission = undefined;
	if (answer !== 'dismiss')
		for (const kind of request.kinds) sitePermits.set(`${tab.partition} ${request.origin} ${kind}`, answer === 'allow');
	request.answer(answer === 'allow');
	paneEvents.emit('change');
}
