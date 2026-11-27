import { chromium, type BrowserContext, type Page } from 'playwright-core';
import { z } from 'zod';
import { BROWSER_ROUTES } from '../../../../shared/browser';
import { leaks } from '../../../shield/leaks';
import { saveMedia } from '../../../shared/media';
import { publicUrl } from '../../../public';
import { requireUnrestrictedNetwork } from '../../../privacy/state';
import { executionScope } from '../../execution/scope';
import { mediaAccess } from '../../permissions/media_access';
import { tool } from '../tool';
import { runBrowserPageOperation } from './browser_abort';
import { observe } from './browser/observe';
import { run } from './browser/run';
import { browserSession, browserSessions, type BrowserSession } from './browser/session';
import { SNAPSHOT_SCRIPT } from './browser/snapshot';

const ACTIONS = [
	'status',
	'start',
	'stop',
	'tabs',
	'open',
	'focus',
	'close',
	'navigate',
	'snapshot',
	'screenshot',
	'pdf',
	'archive',
	'console',
	'act',
] as const;

const ACT_KINDS = [
	'click',
	'type',
	'press',
	'hover',
	'drag',
	'select',
	'fill',
	'wait',
	'evaluate',
	'scroll',
] as const;

const SNAPSHOT_MAX_TEXT = 4_000;
const CONSOLE_BUFFER_MAX = 100;
const DEFAULT_TIMEOUT_MS = 15_000;
const pageOwners = new WeakMap<Page, string>();

function trackPage(page: Page, session: BrowserSession = browserSession()): string {
	const id = `t${session.nextTabId++}`;
	session.pages.set(id, page);
	session.consoleLogs.set(id, []);
	page.on('console', (msg) => {
		const logs = session.consoleLogs.get(id);
		if (!logs) return;
		logs.push(`[${msg.type()}] ${msg.text()}`);
		if (logs.length > CONSOLE_BUFFER_MAX) logs.shift();
	});
	page.on('close', () => {
		session.pages.delete(id);
		session.consoleLogs.delete(id);
	});
	return id;
}

async function ensureStarted(signal?: AbortSignal): Promise<BrowserContext> {
	signal?.throwIfAborted();
	requireUnrestrictedNetwork();
	const session = browserSession();
	if (session.closed) throw new Error('Browser run has ended.');
	if (session.context) return session.context;
	if (!session.starting) {
		session.starting = chromium.launchPersistentContext('', {
			channel: 'chrome',
			headless: true,
			viewport: null,
			timeout: DEFAULT_TIMEOUT_MS,
		}).then(async (launched) => {
			if (session.closed || signal?.aborted) {
				await launched.close();
				signal?.throwIfAborted();
				throw new Error('Browser run has ended.');
			}
			session.context = launched;
			launched.setDefaultTimeout(DEFAULT_TIMEOUT_MS);
			await launched.route('**/*', async (route) => {
				const request = route.request();
				const allowed =
					!leaks(request.url()) &&
					!leaks(request.postData() ?? '') &&
					(await publicUrl(request.url()).then(() => true, () => false));
				await (allowed ? route.continue() : route.abort('blockedbyclient')).catch(() => undefined);
			});
			launched.on('page', (page) => {
				if (![...session.pages.values()].includes(page)) trackPage(page, session);
				void page.opener().then((opener) => {
					const owner = opener && pageOwners.get(opener);
					if (owner) pageOwners.set(page, owner);
				}, () => undefined);
			});
			launched.on('close', () => {
				session.context = null;
				session.pages.clear();
				session.consoleLogs.clear();
			});
			for (const page of launched.pages()) trackPage(page, session);
			return launched;
		}, (cause: unknown) => {
			signal?.throwIfAborted();
			const detail = cause instanceof Error ? cause.message : String(cause);
			throw new Error(
				`Browser automation could not start Google Chrome. Make sure Chrome is installed, permitted by system policy, and able to write to the Kucedr profile.\n${detail}`,
				{ cause }
			);
		}).finally(() => { session.starting = undefined; });
	}
	const launched = await session.starting;
	signal?.throwIfAborted();
	return launched;
}

function getPage(targetId?: string): { id: string; page: Page } {
	const { pages } = browserSession();
	if (targetId) {
		const page = pages.get(targetId);
		if (!page) throw new Error(`Unknown tab "${targetId}". Use action "tabs" to list open tabs.`);
		return { id: targetId, page };
	}
	const entries = [...pages.entries()];
	const owner = executionScope.getStore()?.ownerId;
	const last =
		entries.filter(([, page]) => pageOwners.get(page) === owner).at(-1) ??
		(entries.length === 1 ? entries[0] : undefined);
	if (!last)
		throw new Error(
			entries.length
				? 'Several tabs are open and none was opened by this chat. Pass a targetId from action "tabs".'
				: 'No open tabs. Use action "open" with a url first.'
		);
	return { id: last[0], page: last[1] };
}

async function assertHttpUrl(url: string): Promise<string> {
	const parsed = new URL(url);
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
		throw new Error('Invalid URL: must be http or https');
	await publicUrl(parsed.toString());
	return parsed.toString();
}

function refSelector(ref: string): string {
	if (!/^e\d+$/.test(ref)) throw new Error(`Invalid ref "${ref}". Refs look like "e12" from snapshot output.`);
	return `[data-agent-ref="${ref}"]`;
}


async function tabList(signal?: AbortSignal): Promise<{ targetId: string; url: string; title: string }[]> {
	const list: { targetId: string; url: string; title: string }[] = [];
	for (const [targetId, page] of browserSession().pages) {
		signal?.throwIfAborted();
		list.push({ targetId, url: page.url(), title: await page.title().catch(() => '') });
	}
	return list;
}

async function runAct(params: {
	kind: (typeof ACT_KINDS)[number];
	targetId?: string;
	ref?: string;
	text?: string;
	key?: string;
	values?: string[];
	fields?: { ref: string; value: string }[];
	startRef?: string;
	endRef?: string;
	submit?: boolean;
	doubleClick?: boolean;
	button?: 'left' | 'right' | 'middle';
	fn?: string;
	timeMs?: number;
	selector?: string;
	loadState?: 'load' | 'domcontentloaded' | 'networkidle';
	timeoutMs?: number;
	direction?: 'up' | 'down' | 'left' | 'right';
	amount?: number;
}, signal?: AbortSignal): Promise<string> {
	const { page } = getPage(params.targetId);
	return runBrowserPageOperation(page, signal, async () => {
		const timeout = params.timeoutMs;
		const locator = (ref: string) => page.locator(refSelector(ref));
		const requireRef = (): string => {
			if (!params.ref) throw new Error(`act "${params.kind}" requires a ref from snapshot output.`);
			return params.ref;
		};

		switch (params.kind) {
		case 'click':
			await locator(requireRef()).click({
				button: params.button,
				clickCount: params.doubleClick ? 2 : 1,
				timeout,
			});
			return 'clicked';
		case 'type': {
			const target = locator(requireRef());
			await target.fill(params.text ?? '', { timeout });
			if (params.submit) await target.press('Enter', { timeout });
			return 'typed';
		}
		case 'press':
			if (!params.key) throw new Error('act "press" requires a key (e.g. "Enter", "Tab").');
			await page.keyboard.press(params.key);
			return `pressed ${params.key}`;
		case 'hover':
			await locator(requireRef()).hover({ timeout });
			return 'hovered';
		case 'drag':
			if (!params.startRef || !params.endRef)
				throw new Error('act "drag" requires startRef and endRef.');
			await locator(params.startRef).dragTo(locator(params.endRef), { timeout });
			return 'dragged';
		case 'select': {
			if (!params.values?.length) throw new Error('act "select" requires values.');
			const selected = await locator(requireRef()).selectOption(params.values, { timeout });
			return `selected ${JSON.stringify(selected)}`;
		}
		case 'fill': {
			if (!params.fields?.length) throw new Error('act "fill" requires fields: [{ref, value}].');
			for (const field of params.fields) {
				await locator(field.ref).fill(field.value ?? '', { timeout });
			}
			return `filled ${params.fields.length} field(s)`;
		}
		case 'wait':
			if (params.selector) await page.waitForSelector(params.selector, { timeout });
			else if (params.loadState) await page.waitForLoadState(params.loadState, { timeout });
			else await page.waitForTimeout(params.timeMs ?? 1_000);
			return 'waited';
		case 'scroll': {
			if (params.ref) {
				await locator(params.ref).scrollIntoViewIfNeeded({ timeout });
				return `scrolled to ${params.ref}`;
			}
			const direction = params.direction ?? 'down';
			const vertical = direction === 'up' || direction === 'down';
			const [width, height] = (await page.evaluate('[innerWidth, innerHeight]')) as [number, number];
			const delta = (vertical ? height : width) * (params.amount ?? 1) * (direction === 'up' || direction === 'left' ? -1 : 1);
			await page.mouse.move(width / 2, height / 2);
			await page.mouse.wheel(vertical ? 0 : delta, vertical ? delta : 0);
			return `scrolled ${direction}`;
		}
		case 'evaluate': {
			if (!params.fn) throw new Error('act "evaluate" requires fn (a JS expression or function).');
				const result = await page.evaluate(params.fn);
				return JSON.stringify(result) ?? 'undefined';
			}
		}
	});
}

export const useWebBrowserTool = tool({
	id: 'use_web_browser',
	category: 'web',
	name: 'Use web browser',
	description:
		'Use the browser shown in a pane beside the chat for interactive web tasks: sign-ins, clicking, filling forms, scrolling, screenshots, PDFs, pages that need JavaScript. Heavier than fetch_web_page. The user sees every page and can click and type in it too. "This page" means the tab on screen; without a targetId, actions go to the tab this reply last used, else the tab on screen, else this chat\'s last tab. Typical flow: snapshot (get element refs) → act (click/type/scroll on refs) → snapshot again. Refs change after navigation, and after the user has used the page. Logins survive restarts. Close only tabs you opened; the user closes the rest.',
	inputSchema: z.object({
		action: z.enum(ACTIONS).describe('Browser command to run.'),
		targetId: z
			.string()
			.optional()
			.describe('Tab id from "tabs" output, which marks the tab on screen ("shown") and this chat\'s tabs ("mine").'),
		url: z.string().optional().describe('URL for open/navigate.'),
		route: z
			.enum(BROWSER_ROUTES)
			.optional()
			.describe(
				'open: how the new tab connects. "private": no logins, history or cookies kept, wiped when closed. "tor": through Tor, needed for .onion sites; Tor must be running and the user approves. "proxy": through the proxy the user set. Default "direct", with the user\'s logins. Only the browser is routed; page text you read still reaches the model provider.'
			),
		back: z.boolean().optional().describe('navigate: go back in history instead of to a url.'),
		forward: z.boolean().optional().describe('navigate: go forward in history.'),
		reload: z.boolean().optional().describe('navigate: reload the page.'),
		fullPage: z.boolean().optional().describe('screenshot: capture the full scrollable page.'),
		directory: z.string().optional().describe(
			'screenshot/pdf: directory to save the file in. Defaults to ~/.kucedr/library; only set it when the user asks for a specific location. Relative paths resolve from the agent workspace; absolute paths and ~ are supported.'
		),
		limit: z.number().int().min(1).optional().describe('console: max messages to return.'),
		maxChars: z.number().int().min(100).optional().describe('snapshot: max page text characters.'),
		kind: z.enum(ACT_KINDS).optional().describe('act: interaction kind.'),
		ref: z.string().optional().describe('act/screenshot: element ref from snapshot (e.g. "e12"). act scroll: scroll it into view.'),
		direction: z.enum(['up', 'down', 'left', 'right']).optional().describe('act scroll: direction without a ref. Default down.'),
		amount: z.number().min(0.1).max(20).optional().describe('act scroll: screens to scroll. Default 1.'),
		text: z.string().optional().describe('act type: text to enter.'),
		submit: z.boolean().optional().describe('act type: press Enter after typing.'),
		doubleClick: z.boolean().optional().describe('act click: double-click.'),
		button: z.enum(['left', 'right', 'middle']).optional().describe('act click: mouse button.'),
		key: z.string().optional().describe('act press: key name, e.g. "Enter", "Tab", "ArrowDown".'),
		values: z.array(z.string()).optional().describe('act select: option values to select.'),
		fields: z
			.array(z.object({ ref: z.string(), value: z.string() }))
			.optional()
			.describe('act fill: multiple {ref, value} pairs.'),
		startRef: z.string().optional().describe('act drag: source element ref.'),
		endRef: z.string().optional().describe('act drag: destination element ref.'),
		fn: z.string().optional().describe('act evaluate: JavaScript to run in the page.'),
		timeMs: z.number().int().min(0).optional().describe('act wait: milliseconds to wait.'),
		selector: z.string().optional().describe('act wait: CSS selector to wait for.'),
		loadState: z
			.enum(['load', 'domcontentloaded', 'networkidle'])
			.optional()
			.describe('act wait: page load state to wait for.'),
		timeoutMs: z.number().int().min(1).optional().describe('act: per-action timeout override.'),
	}),
	access: ({ action, directory }) =>
		action === 'screenshot' || action === 'pdf' ? mediaAccess(directory) : {},
	execute: async (params, signal) => {
		signal?.throwIfAborted();
		if (!browserSessions.getStore()) return observe(() => run(params, signal));
		if (params.route && params.route !== 'direct')
			throw new Error('Private, Tor and proxy tabs are only available in the browser pane, not in background runs.');
		const session = browserSession();
		if (session.closed) throw new Error('Browser run has ended.');
		switch (params.action) {
			case 'status':
				return JSON.stringify({ running: session.context !== null, tabs: await tabList(signal) });
			case 'start': {
				await ensureStarted(signal);
				return JSON.stringify({ running: true, tabs: await tabList(signal) });
			}
			case 'stop': {
				if (session.context) await session.context.close();
				return JSON.stringify({ running: false });
			}
			case 'tabs':
				return JSON.stringify({ tabs: await tabList(signal) });
			case 'open': {
				if (!params.url) throw new Error('open requires a url.');
				const url = await assertHttpUrl(params.url);
				const ctx = await ensureStarted(signal);
				const page = await ctx.newPage();
				const owner = executionScope.getStore()?.ownerId;
				if (owner) pageOwners.set(page, owner);
				const targetId = [...session.pages.entries()].find(([, p]) => p === page)?.[0] ?? trackPage(page);
				try {
					await runBrowserPageOperation(page, signal, () =>
						page.goto(url, { waitUntil: 'domcontentloaded' })
					);
				} catch (error) {
					await page.close().catch(() => undefined);
					throw error;
				}
				return JSON.stringify({ targetId, url: page.url(), title: await page.title() });
			}
			case 'focus': {
				const { id, page } = getPage(params.targetId);
				await runBrowserPageOperation(page, signal, () => page.bringToFront());
				return JSON.stringify({ targetId: id, url: page.url() });
			}
			case 'close': {
				const { id, page } = getPage(params.targetId);
				await page.close();
				return JSON.stringify({ closed: id, tabs: await tabList(signal) });
			}
			case 'navigate': {
				const { id, page } = getPage(params.targetId);
				await runBrowserPageOperation(page, signal, async () => {
					if (params.back) await page.goBack({ waitUntil: 'domcontentloaded' });
					else if (params.forward) await page.goForward({ waitUntil: 'domcontentloaded' });
					else if (params.reload) await page.reload({ waitUntil: 'domcontentloaded' });
					else if (params.url)
						await page.goto(await assertHttpUrl(params.url), { waitUntil: 'domcontentloaded' });
					else throw new Error('navigate requires url, back, forward, or reload.');
				});
				return JSON.stringify({ targetId: id, url: page.url(), title: await page.title() });
			}
			case 'snapshot': {
				const { id, page } = getPage(params.targetId);
				const snapshot = (await runBrowserPageOperation(page, signal, () =>
					page.evaluate(SNAPSHOT_SCRIPT)
				)) as {
					title: string;
					text: string;
					elements: unknown[];
				};
				const maxText = params.maxChars ?? SNAPSHOT_MAX_TEXT;
				return JSON.stringify({
					targetId: id,
					url: page.url(),
					title: snapshot.title,
					text: snapshot.text.slice(0, maxText),
					textTruncated: snapshot.text.length > maxText,
					elements: snapshot.elements,
				});
			}
			case 'screenshot': {
				const { id, page } = getPage(params.targetId);
				const data = await runBrowserPageOperation(page, signal, () =>
					params.ref
						? page.locator(refSelector(params.ref)).screenshot()
						: page.screenshot({ fullPage: params.fullPage })
				);
				const file = await saveMedia(
					'browser', 'png', data.toString('base64'), params.directory, signal
				);
				return JSON.stringify({ targetId: id, path: file });
			}
			case 'pdf': {
				const { id, page } = getPage(params.targetId);
				const data = await runBrowserPageOperation(page, signal, () => page.pdf());
				const file = await saveMedia(
					'browser', 'pdf', data.toString('base64'), params.directory, signal
				);
				return JSON.stringify({ targetId: id, path: file });
			}
			case 'console': {
				const { id } = getPage(params.targetId);
				const logs = session.consoleLogs.get(id) ?? [];
				return JSON.stringify({ targetId: id, messages: logs.slice(-(params.limit ?? 50)) });
			}
			case 'act': {
				if (!params.kind) throw new Error('act requires a kind (click, type, press, ...).');
				const result = await runAct({ ...params, kind: params.kind }, signal);
				return JSON.stringify({ result });
			}
		}
	},
});
