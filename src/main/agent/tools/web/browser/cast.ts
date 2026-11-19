import type { Page } from 'playwright-core';
import type { BrowserPaneFrame } from '../../../../../shared/browser';

// ponytail: every frame Chrome offers is forwarded as JPEG; delay the ack to cap the
// rate if video-heavy pages make the window sluggish
export function cast(
	page: Page,
	send: (frame: Omit<BrowserPaneFrame, 'targetId'>) => void
): () => void {
	let stopped = false;
	const session = page
		.context()
		.newCDPSession(page)
		.then(async (cdp) => {
			cdp.on('Page.screencastFrame', (frame) => {
				if (stopped) return;
				send({
					data: frame.data,
					width: frame.metadata.deviceWidth,
					height: frame.metadata.deviceHeight,
				});
				void cdp
					.send('Page.screencastFrameAck', { sessionId: frame.sessionId })
					.catch(() => undefined);
			});
			await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80 });
			return cdp;
		});
	session.catch(() => undefined);
	return () => {
		stopped = true;
		void session.then((cdp) => cdp.detach()).catch(() => undefined);
	};
}
