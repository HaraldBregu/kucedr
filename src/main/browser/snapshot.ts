import path from 'node:path';
import { paneTabs } from '../agent/tools/web/browser/pane';
import { userDataLocation } from '../shared/user_data_location';
import { writeFileAtomic } from './write';

const ENTRY_LIMIT = 50;
const TAB_LIMIT = 100;
const DELAY_MS = 1_000;

let last = '';
let timer: NodeJS.Timeout | undefined;
let closed = false;

export function saveTabs(final = false): void {
	if (closed) return;
	const write = (): void => {
		timer = undefined;
		const saved: { chat: string; order: number; entries: { url: string; title: string }[]; index: number }[] = [];
		for (const tab of [...paneTabs.values()].sort((a, b) => a.position - b.position)) {
			const contents = tab.view.webContents;
			if (tab.chat === undefined || contents.isDestroyed()) continue;
			const all = tab.pending ?? {
				entries: contents.navigationHistory.getAllEntries(),
				index: contents.navigationHistory.getActiveIndex(),
			};
			const kept = all.entries
				.map((entry, at) => ({ url: entry.url, title: entry.title, at }))
				.filter((entry) => /^https?:/i.test(entry.url));
			if (!kept.length) continue;
			const index = Math.max(0, kept.findLastIndex((entry) => entry.at <= all.index));
			const start = Math.max(0, Math.min(index, kept.length - ENTRY_LIMIT));
			saved.push({
				chat: tab.chat,
				order: tab.order,
				entries: kept.slice(start, start + ENTRY_LIMIT).map(({ url, title }) => ({ url, title })),
				index: index - start,
			});
		}
		const tabs = JSON.stringify(saved.slice(0, TAB_LIMIT));
		if (tabs === last) return;
		last = tabs;
		writeFileAtomic(path.join(userDataLocation(), 'browser', 'tabs.json'), `{"saved":${Date.now()},"tabs":${tabs}}`);
	};
	if (final) {
		clearTimeout(timer);
		closed = true;
		write();
		return;
	}
	timer ??= setTimeout(write, DELAY_MS);
}
