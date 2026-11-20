import { saveMedia } from '../../../../shared/media';
import { executionScope } from '../../../execution/scope';
import { act, type BrowserAct } from './act';
import { closeTab } from './close';
import { createTab } from './create';
import { cursor } from './cursor';
import { locate } from './locate';
import { pane, paneTabs, type BrowserTab } from './pane';
import { settle } from './settle';
import { SNAPSHOT_SCRIPT } from './snapshot';

const SNAPSHOT_MAX_TEXT = 4_000;

export interface BrowserRun extends Omit<BrowserAct, 'kind'> {
	action:
		| 'status'
		| 'start'
		| 'stop'
		| 'tabs'
		| 'open'
		| 'focus'
		| 'close'
		| 'navigate'
		| 'snapshot'
		| 'screenshot'
		| 'pdf'
		| 'console'
		| 'act';
	kind?: BrowserAct['kind'];
	targetId?: string;
	url?: string;
	back?: boolean;
	forward?: boolean;
	fullPage?: boolean;
	directory?: string;
	limit?: number;
	maxChars?: number;
}

interface Capture {
	data: string;
}

export async function run(params: BrowserRun, signal?: AbortSignal): Promise<string> {
	const scope = executionScope.getStore();
	const list = (): { targetId: string; url: string; title: string }[] =>
		[...paneTabs.values()].map((tab) => ({
			targetId: tab.id,
			url: tab.view.webContents.getURL(),
			title: tab.view.webContents.getTitle(),
		}));
	const address = (value: string): string => {
		const parsed = new URL(value);
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
			throw new Error('Invalid URL: must be http or https');
		return parsed.toString();
	};
	const current = (): BrowserTab => {
		const all = [...paneTabs.values()];
		const tab = params.targetId
			? paneTabs.get(params.targetId)
			: (all.filter((candidate) => candidate.owner === scope?.ownerId).at(-1) ??
				(all.length === 1 ? all[0] : undefined));
		if (!tab)
			throw new Error(
				params.targetId
					? `Unknown tab "${params.targetId}". Use action "tabs" to list open tabs.`
					: all.length
						? 'Several tabs are open and none was opened by this chat. Pass a targetId from action "tabs".'
						: 'No open tabs. Use action "open" with a url first.'
			);
		if (!tab.owner && scope) {
			tab.owner = scope.ownerId;
			tab.chat = scope.sessionId;
		}
		tab.order = ++pane.order;
		return tab;
	};
	const describe = (tab: BrowserTab): string =>
		JSON.stringify({
			targetId: tab.id,
			url: tab.view.webContents.getURL(),
			title: tab.view.webContents.getTitle(),
		});
	const capture = (tab: BrowserTab, options: object = {}): Promise<Capture> =>
		tab.view.webContents.debugger.sendCommand('Page.captureScreenshot', {
			format: 'png',
			...options,
		}) as Promise<Capture>;

	switch (params.action) {
		case 'status':
			return JSON.stringify({ running: paneTabs.size > 0, tabs: list() });
		case 'start':
			if (![...paneTabs.values()].some((tab) => tab.owner === scope?.ownerId))
				createTab(scope?.sessionId, scope?.ownerId);
			return JSON.stringify({ running: true, tabs: list() });
		case 'stop':
			for (const tab of [...paneTabs.values()]) closeTab(tab);
			return JSON.stringify({ running: false });
		case 'tabs':
			return JSON.stringify({ tabs: list() });
		case 'open': {
			if (!params.url) throw new Error('open requires a url.');
			const url = address(params.url);
			const tab = createTab(scope?.sessionId, scope?.ownerId);
			const contents = tab.view.webContents;
			try {
				await settle(contents, () => void contents.loadURL(url).catch(() => undefined), signal);
			} catch (error) {
				closeTab(tab);
				throw error;
			}
			return describe(tab);
		}
		case 'focus': {
			const tab = current();
			return JSON.stringify({ targetId: tab.id, url: tab.view.webContents.getURL() });
		}
		case 'close': {
			const tab = current();
			closeTab(tab);
			return JSON.stringify({ closed: tab.id, tabs: list() });
		}
		case 'navigate': {
			const tab = current();
			const contents = tab.view.webContents;
			const history = contents.navigationHistory;
			if (params.back) {
				if (history.canGoBack()) await settle(contents, () => history.goBack(), signal);
			} else if (params.forward) {
				if (history.canGoForward()) await settle(contents, () => history.goForward(), signal);
			} else if (params.url) {
				const url = address(params.url);
				await settle(contents, () => void contents.loadURL(url).catch(() => undefined), signal);
			} else throw new Error('navigate requires url, back, or forward.');
			return describe(tab);
		}
		case 'snapshot': {
			const tab = current();
			const snapshot = (await tab.view.webContents.executeJavaScript(SNAPSHOT_SCRIPT, true)) as {
				title: string;
				text: string;
				elements: unknown[];
			};
			const maxText = params.maxChars ?? SNAPSHOT_MAX_TEXT;
			return JSON.stringify({
				targetId: tab.id,
				url: tab.view.webContents.getURL(),
				title: snapshot.title,
				text: snapshot.text.slice(0, maxText),
				textTruncated: snapshot.text.length > maxText,
				elements: snapshot.elements,
			});
		}
		case 'screenshot': {
			const tab = current();
			await cursor(tab, 'clear');
			let shot: Capture;
			if (params.ref) {
				await locate(tab, params.ref, params.timeoutMs, signal);
				const clip = (await tab.view.webContents.executeJavaScript(
					`(() => {
						const rect = document.querySelector('[data-agent-ref="${params.ref}"]').getBoundingClientRect();
						return { x: rect.left + scrollX, y: rect.top + scrollY, width: rect.width, height: rect.height, scale: 1 };
					})()`,
					true
				)) as object;
				shot = await capture(tab, { clip, captureBeyondViewport: true });
			} else if (params.fullPage) {
				const { cssContentSize } = (await tab.view.webContents.debugger.sendCommand(
					'Page.getLayoutMetrics'
				)) as { cssContentSize: { width: number; height: number } };
				shot = await capture(tab, {
					clip: { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 },
					captureBeyondViewport: true,
				});
			} else shot = await capture(tab);
			const file = await saveMedia('browser', 'png', shot.data, params.directory, signal);
			return JSON.stringify({ targetId: tab.id, path: file });
		}
		case 'pdf': {
			const tab = current();
			const data = await tab.view.webContents.printToPDF({});
			const file = await saveMedia('browser', 'pdf', data.toString('base64'), params.directory, signal);
			return JSON.stringify({ targetId: tab.id, path: file });
		}
		case 'console': {
			const tab = current();
			return JSON.stringify({ targetId: tab.id, messages: tab.logs.slice(-(params.limit ?? 50)) });
		}
		case 'act': {
			if (!params.kind) throw new Error('act requires a kind (click, type, press, ...).');
			const result = await act(current(), { ...params, kind: params.kind }, signal);
			return JSON.stringify({ result });
		}
	}
}
