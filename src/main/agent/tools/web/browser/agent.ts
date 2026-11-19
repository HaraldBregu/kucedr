import { chromium } from 'playwright-core';

let known: Promise<string | undefined> | undefined;

// ponytail: windowless Chrome names itself "HeadlessChrome" and sign-in pages refuse it;
// one throwaway launch per app run reads the real string. Read the installed version
// from disk instead if that launch ever costs too much.
export function userAgent(): Promise<string | undefined> {
	known ??= (async () => {
		const browser = await chromium.launch({ channel: 'chrome', headless: true });
		try {
			const page = await browser.newPage();
			const agent = await page.evaluate<string>('navigator.userAgent');
			return agent.replace('HeadlessChrome', 'Chrome');
		} finally {
			await browser.close();
		}
	})().catch(() => undefined);
	return known;
}
