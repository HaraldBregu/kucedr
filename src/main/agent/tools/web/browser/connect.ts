import { chromium, type BrowserContext } from 'playwright-core';
import type { BrowserSession } from './session';

export async function connectChrome(session: BrowserSession): Promise<BrowserContext> {
	const browser = await chromium.connectOverCDP('chrome', {
		noDefaults: true,
		headers: { 'User-Agent': 'Kucedr' },
		timeout: 60_000,
	});
	const context = browser.contexts()[0];
	if (!context) {
		await browser.close();
		throw new Error('Google Chrome has no available personal browser context.');
	}
	session.disconnect = () => browser.close();
	return context;
}
