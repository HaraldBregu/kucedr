import type { Page } from 'playwright-core';
import { pane } from './pane';

export async function fit(page: Page): Promise<void> {
	const cdp = await page.context().newCDPSession(page);
	try {
		const { windowId, bounds } = await cdp.send('Browser.getWindowForTarget');
		const { cssLayoutViewport } = await cdp.send('Page.getLayoutMetrics');
		await cdp.send('Browser.setWindowBounds', {
			windowId,
			bounds: {
				width: pane.width,
				height: pane.height + (bounds.height ?? 0) - cssLayoutViewport.clientHeight,
			},
		});
	} finally {
		await cdp.detach().catch(() => undefined);
	}
}
