import path from 'node:path';
import { readSealed } from '../vault/read';
import { createTab } from '../agent/tools/web/browser/create';
import { pane, paneEvents } from '../agent/tools/web/browser/pane';
import { currentWorkspace } from '../workspaces/current';
import { aside } from './aside';

export function restoreTabs(): void {
	const file = path.join(currentWorkspace().browser, 'tabs.json');
	try {
		const saved = JSON.parse(readSealed(file)) as {
			tabs: {
				chat: string;
				agent?: boolean;
				order: number;
				entries: { url: string; title: string }[];
				index: number;
			}[];
		};
		for (const item of saved.tabs) {
			const tab = createTab(item.chat);
			tab.agent = item.agent === true;
			tab.pending = { entries: item.entries, index: item.index };
			tab.order = item.order;
			pane.order = Math.max(pane.order, item.order);
		}
	} catch {
		aside(file);
	}
	paneEvents.emit('change');
}
