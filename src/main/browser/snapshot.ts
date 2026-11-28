import path from 'node:path';
import { paneTabs } from '../agent/tools/web/browser/pane';
import { seal } from '../vault/seal';
import { writeFileAtomic } from './write';

const ENTRY_LIMIT = 50;
const TAB_LIMIT = 100;
const DELAY_MS = 1_000;

const last = new Map<string, string>();
let timer: NodeJS.Timeout | undefined;
let closed = false;

export function saveTabs(final = false): void {
	if (closed) return;
	const write = (): void => {
		timer = undefined;
		const saved = new Map<
			string,
			{
				chat: string;
				agent?: boolean;
				order: number;
				entries: { url: string; title: string }[];
				index: number;
			}[]
		>([...last.keys()].map((directory) => [directory, []]));
		for (const tab of [...paneTabs.values()].sort((a, b) => a.position - b.position)) {
			const contents = tab.view.webContents;
			// Private, Tor and proxy tabs leave nothing behind, so they are not restored.
			if (tab.chat === undefined || tab.route !== 'direct' || contents.isDestroyed()) continue;
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
			const list = saved.get(tab.workspace.browser) ?? [];
			saved.set(tab.workspace.browser, list);
			list.push({
				chat: tab.chat,
				...(tab.agent ? { agent: true } : {}),
				order: tab.order,
				entries: kept.slice(start, start + ENTRY_LIMIT).map(({ url, title }) => ({ url, title })),
				index: index - start,
			});
		}
		for (const [directory, list] of saved) {
			const tabs = JSON.stringify(list.slice(0, TAB_LIMIT));
			if (tabs === last.get(directory)) continue;
			last.set(directory, tabs);
			writeFileAtomic(path.join(directory, 'tabs.json'), seal(`{"saved":${Date.now()},"tabs":${tabs}}`));
		}
	};
	if (final) {
		clearTimeout(timer);
		closed = true;
		write();
		return;
	}
	timer ??= setTimeout(write, DELAY_MS);
}
