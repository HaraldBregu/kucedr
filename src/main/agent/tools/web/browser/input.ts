import type { Page } from 'playwright-core';
import type { BrowserPaneInput } from '../../../../../shared/browser';

// ponytail: clicks carry no modifier keys and there is no IME composition; move to raw
// CDP input events if shift-click or composed text is needed
export async function input(page: Page, event: BrowserPaneInput): Promise<void> {
	switch (event.type) {
		case 'move':
			return page.mouse.move(event.x, event.y);
		case 'down':
			await page.mouse.move(event.x, event.y);
			return page.mouse.down({ button: event.button, clickCount: event.count });
		case 'up':
			return page.mouse.up({ button: event.button, clickCount: event.count });
		case 'wheel':
			await page.mouse.move(event.x, event.y);
			return page.mouse.wheel(event.deltaX, event.deltaY);
		case 'type':
			return page.keyboard.type(event.text);
		case 'paste':
			return page.keyboard.insertText(event.text);
		case 'press':
			return page.keyboard.press(event.key);
	}
}
