import os from 'node:os';
import path from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import { z } from 'zod';
import { userDataLocation } from '../../../shared/user_data_location';
import { tool } from '../tool';
import { runBrowserPageOperation } from './browser_abort';
import { browserSession, type BrowserSession } from './browser/session';

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
] as const;

const SNAPSHOT_MAX_TEXT = 4_000;
const CONSOLE_BUFFER_MAX = 100;
const DEFAULT_TIMEOUT_MS = 15_000;

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
	const session = browserSession();
	if (session.closed) throw new Error('Browser run has ended.');
	if (session.context) return session.context;
	if (!session.starting) {
		const userDataDir = session.headless ? '' : path.join(userDataLocation(), 'agent-browser');
		session.starting = chromium.launchPersistentContext(userDataDir, {
			channel: 'chrome',
			headless: session.headless,
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
			launched.on('page', (page) => {
				if (![...session.pages.values()].includes(page)) trackPage(page, session);
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
	const last = [...pages.entries()].at(-1);
	if (!last) throw new Error('No open tabs. Use action "open" with a url first.');
	return { id: last[0], page: last[1] };
}

// ponytail: scheme check only, no private-host blocking — driving localhost apps
// is a core use case, and the agent already has exec/file tools (no new access)
function assertHttpUrl(url: string): string {
	const parsed = new URL(url);
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
		throw new Error('Invalid URL: must be http or https');
	return parsed.toString();
}

function refSelector(ref: string): string {
	if (!/^e\d+$/.test(ref)) throw new Error(`Invalid ref "${ref}". Refs look like "e12" from snapshot output.`);
	return `[data-agent-ref="${ref}"]`;
}

// Runs in the page: tags interactive elements with data-agent-ref and returns a compact outline.
const SNAPSHOT_SCRIPT = `(() => {
	const selector = 'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"], [role="combobox"], [contenteditable="true"]';
	const visible = (el) => {
		const rect = el.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return false;
		const style = getComputedStyle(el);
		return style.visibility !== 'hidden' && style.display !== 'none';
	};
	const elements = [];
	let i = 0;
	for (const el of document.querySelectorAll(selector)) {
		if (!visible(el)) continue;
		i += 1;
		const ref = 'e' + i;
		el.setAttribute('data-agent-ref', ref);
		elements.push({
			ref,
			tag: el.tagName.toLowerCase(),
			role: el.getAttribute('role') || undefined,
			type: el.getAttribute('type') || undefined,
			text: (el.innerText || el.value || '').trim().slice(0, 120) || undefined,
			name: el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || undefined,
			href: el.getAttribute('href') || undefined,
		});
	}
	return { title: document.title, text: (document.body?.innerText || '').trim(), elements };
})()`;

async function tabList(signal?: AbortSignal): Promise<{ targetId: string; url: string; title: string }[]> {
	const list: { targetId: string; url: string; title: string }[] = [];
	for (const [targetId, page] of browserSession().pages) {
		signal?.throwIfAborted();
		list.push({ targetId, url: page.url(), title: await page.title().catch(() => '') });
	}
	return list;
}

function tempFile(ext: string): string {
	return path.join(os.tmpdir(), `browser-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
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
	name: 'Use web browser',
	description:
		'Drive a real Chrome browser for interactive web tasks: login flows, clicking UI, screenshots, PDFs, pages that need JavaScript. Heavier than fetch_web_page. Typical flow: open → snapshot (get element refs) → act (click/type on refs). The browser uses a persistent profile, so logins survive restarts.',
	inputSchema: z.object({
		action: z.enum(ACTIONS).describe('Browser command to run.'),
		targetId: z.string().optional().describe('Tab id from "tabs" output. Defaults to the most recent tab.'),
		url: z.string().optional().describe('URL for open/navigate.'),
		back: z.boolean().optional().describe('navigate: go back in history instead of to a url.'),
		forward: z.boolean().optional().describe('navigate: go forward in history.'),
		fullPage: z.boolean().optional().describe('screenshot: capture the full scrollable page.'),
		limit: z.number().int().min(1).optional().describe('console: max messages to return.'),
		maxChars: z.number().int().min(100).optional().describe('snapshot: max page text characters.'),
		kind: z.enum(ACT_KINDS).optional().describe('act: interaction kind.'),
		ref: z.string().optional().describe('act/screenshot: element ref from snapshot (e.g. "e12").'),
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
	execute: async (params, signal) => {
		signal?.throwIfAborted();
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
				const url = assertHttpUrl(params.url);
				const ctx = await ensureStarted(signal);
				const page = await ctx.newPage();
				const targetId = [...session.pages.entries()].find(([, p]) => p === page)?.[0] ?? trackPage(page);
				await runBrowserPageOperation(page, signal, () =>
					page.goto(url, { waitUntil: 'domcontentloaded' })
				);
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
					else if (params.url)
						await page.goto(assertHttpUrl(params.url), { waitUntil: 'domcontentloaded' });
					else throw new Error('navigate requires url, back, or forward.');
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
				return JSON.stringify(
					{
						targetId: id,
						url: page.url(),
						title: snapshot.title,
						text: snapshot.text.slice(0, maxText),
						textTruncated: snapshot.text.length > maxText,
						elements: snapshot.elements,
					},
					null,
					2,
				);
			}
			case 'screenshot': {
				const { id, page } = getPage(params.targetId);
				const file = tempFile('png');
				await runBrowserPageOperation(page, signal, async () => {
					if (params.ref) await page.locator(refSelector(params.ref)).screenshot({ path: file });
					else await page.screenshot({ path: file, fullPage: params.fullPage });
				});
				return JSON.stringify({ targetId: id, path: file });
			}
			case 'pdf': {
				const { id, page } = getPage(params.targetId);
				const file = tempFile('pdf');
				await runBrowserPageOperation(page, signal, () => page.pdf({ path: file }));
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
