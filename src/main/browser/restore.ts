import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createTab } from '../agent/tools/web/browser/create';
import { pane, paneEvents } from '../agent/tools/web/browser/pane';
import { userDataLocation } from '../shared/user_data_location';
import { aside } from './aside';

export function restoreTabs(): void {
	const file = path.join(userDataLocation(), 'browser', 'tabs.json');
	try {
		const saved = JSON.parse(readFileSync(file, 'utf8')) as {
			tabs: { chat: string; order: number; entries: { url: string; title: string }[]; index: number }[];
		};
		for (const item of saved.tabs) {
			const tab = createTab(item.chat);
			tab.pending = { entries: item.entries, index: item.index };
			tab.order = item.order;
			pane.order = Math.max(pane.order, item.order);
		}
	} catch {
		aside(file);
	}
	paneEvents.emit('change');
}
