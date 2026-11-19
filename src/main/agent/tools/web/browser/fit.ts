import type { Page } from 'playwright-core';
import { pane } from './pane';

export async function fit(page: Page): Promise<void> {
	const cdp = await page.context().newCDPSession(page);
	try {
		const { windowId } = await cdp.send('Browser.getWindowForTarget');
		await cdp.send('Browser.setContentsSize', {
			windowId,
			width: pane.width,
			height: pane.height,
		});
	} finally {
		await cdp.detach().catch(() => undefined);
	}
}
