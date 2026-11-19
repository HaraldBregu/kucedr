import type { Page, Request } from 'playwright-core';
import { fit } from './fit';
import { pageLoading, paneEvents } from './pane';

export function watch(page: Page): void {
	const changed = (): void => {
		paneEvents.emit('change');
	};
	const loading = (request: Request, started: boolean): void => {
		if (!request.isNavigationRequest() || request.frame() !== page.mainFrame()) return;
		if (started) pageLoading.add(page);
		else pageLoading.delete(page);
		changed();
	};
	page.on('request', (request) => loading(request, true));
	page.on('requestfailed', (request) => loading(request, false));
	page.on('load', () => {
		pageLoading.delete(page);
		changed();
	});
	page.on('framenavigated', (frame) => {
		if (frame === page.mainFrame()) changed();
	});
	page.on('close', changed);
	void fit(page).catch(() => undefined);
}
