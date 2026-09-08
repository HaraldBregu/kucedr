import { EventEmitter } from 'node:events';

const launchPersistentContext = jest.fn();

jest.mock('playwright-core', () => ({ chromium: { launchPersistentContext } }));

import { createBackgroundBrowser } from '../../../../../src/main/agent/tools/web/browser/background';
import { useWebBrowserTool } from '../../../../../src/main/agent/tools/web/use_web_browser';
import { runToolCall } from '../../../../../src/main/agent/runner/run_tool_call';
import type { ToolCall } from '../../../../../src/main/agent/types';

function browserContext() {
	const pageEvents = new EventEmitter();
	let url = 'about:blank';
	const click = jest.fn(async () => undefined);
	const page = Object.assign(pageEvents, {
		click,
		locator: jest.fn(() => ({ click })),
		url: jest.fn(() => url),
		title: jest.fn(async () => url),
		goto: jest.fn(async (nextUrl: string) => { url = nextUrl; }),
		close: jest.fn(async () => { pageEvents.emit('close'); }),
	});
	const events = new EventEmitter();
	return Object.assign(events, {
		page,
		pages: jest.fn(() => []),
		newPage: jest.fn(async () => { events.emit('page', page); return page; }),
		setDefaultTimeout: jest.fn(),
		close: jest.fn(async () => { pageEvents.emit('close'); events.emit('close'); }),
	});
}

beforeEach(() => {
	launchPersistentContext.mockReset();
});

afterEach(async () => {
	await useWebBrowserTool.run({ action: 'stop' });
});

it('isolates background browsers from one another and the interactive profile', async () => {
	const first = createBackgroundBrowser();
	const second = createBackgroundBrowser();
	const foregroundContext = browserContext();
	const firstContext = browserContext();
	const secondContext = browserContext();
	launchPersistentContext
		.mockResolvedValueOnce(foregroundContext)
		.mockResolvedValueOnce(firstContext)
		.mockResolvedValueOnce(secondContext);
	try {
		await useWebBrowserTool.run({ action: 'open', url: 'https://foreground.example/' });
		await first.tool.run({ action: 'open', url: 'https://first.example/' });
		await second.tool.run({ action: 'open', url: 'https://second.example/' });

		expect(launchPersistentContext.mock.calls[0]).toEqual([
			expect.stringContaining('agent-browser'),
			expect.objectContaining({ channel: 'chrome', headless: false }),
		]);
		for (const call of launchPersistentContext.mock.calls.slice(1)) {
			expect(call).toEqual([
				'',
				expect.objectContaining({ channel: 'chrome', headless: true, viewport: null, timeout: 15_000 }),
			]);
		}
		expect(JSON.parse(String(await first.tool.run({ action: 'tabs' })))).toEqual({
			tabs: [{ targetId: 't1', url: 'https://first.example/', title: 'https://first.example/' }],
		});
		expect(JSON.parse(String(await second.tool.run({ action: 'tabs' })))).toEqual({
			tabs: [{ targetId: 't1', url: 'https://second.example/', title: 'https://second.example/' }],
		});
		await first.close();
		expect(firstContext.close).toHaveBeenCalledTimes(1);
		expect(secondContext.close).not.toHaveBeenCalled();
		expect(foregroundContext.close).not.toHaveBeenCalled();
		expect(String(await useWebBrowserTool.run({ action: 'tabs' }))).toContain('foreground.example');
	} finally {
		await first.close();
		await second.close();
	}
});

it('reuses a background context and coalesces concurrent starts', async () => {
	const browser = createBackgroundBrowser();
	const context = browserContext();
	launchPersistentContext.mockResolvedValue(context);
	try {
		await Promise.all([
			browser.tool.run({ action: 'start' }),
			browser.tool.run({ action: 'start' }),
		]);
		await browser.tool.run({ action: 'start' });
		expect(launchPersistentContext).toHaveBeenCalledTimes(1);
	} finally {
		await browser.close();
	}
});

it('closes a launch that finishes after the background browser is disposed', async () => {
	const browser = createBackgroundBrowser();
	const context = browserContext();
	let resolveLaunch!: (value: ReturnType<typeof browserContext>) => void;
	launchPersistentContext.mockReturnValue(new Promise((resolve) => { resolveLaunch = resolve; }));
	const start = browser.tool.run({ action: 'start' });
	const result = expect(start).rejects.toThrow();
	await Promise.resolve();
	const closing = browser.close();
	resolveLaunch(context);
	await closing;
	await result;
	expect(context.close).toHaveBeenCalledTimes(1);
	await expect(browser.tool.run({ action: 'start' })).rejects.toThrow();
	expect(launchPersistentContext).toHaveBeenCalledTimes(1);
});

it('closes a context when cancellation happens while Chrome is launching', async () => {
	const browser = createBackgroundBrowser();
	const context = browserContext();
	const controller = new AbortController();
	let resolveLaunch!: (value: ReturnType<typeof browserContext>) => void;
	launchPersistentContext.mockReturnValue(new Promise((resolve) => { resolveLaunch = resolve; }));
	const start = browser.tool.run({ action: 'start' }, controller.signal);
	const result = expect(start).rejects.toThrow('cancel browser');
	await Promise.resolve();
	controller.abort(new Error('cancel browser'));
	resolveLaunch(context);
	await result;
	expect(context.close).toHaveBeenCalledTimes(1);
	await browser.close();
});

it('reports a missing Chrome installation and permits retrying the launch', async () => {
	const browser = createBackgroundBrowser();
	const context = browserContext();
	launchPersistentContext
		.mockRejectedValueOnce(new Error('Executable does not exist'))
		.mockResolvedValueOnce(context);
	try {
		await expect(browser.tool.run({ action: 'start' })).rejects.toThrow('could not start Google Chrome');
		await browser.tool.run({ action: 'start' });
		expect(launchPersistentContext).toHaveBeenCalledTimes(2);
	} finally {
		await browser.close();
	}
});

it('allows unattended background navigation and browser interactions without approval', async () => {
	const browser = createBackgroundBrowser();
	const context = browserContext();
	launchPersistentContext.mockResolvedValue(context);
	const open: ToolCall = {
		id: 'open', name: 'use_web_browser', args: { action: 'open', url: 'https://example.com/' },
	};
	const click: ToolCall = {
		id: 'click', name: 'use_web_browser', args: { action: 'act', kind: 'click', ref: 'e1' },
	};
	const events = [];
	try {
		for (const call of [open, click]) {
			for await (const event of runToolCall(
				browser.tool, call, new AbortController().signal, undefined, { runId: 'background' }
			)) events.push(event);
		}
		expect(open.result?.isError).toBeUndefined();
		expect(open.result?.content).toContain('https://example.com/');
		expect(context.page.goto).toHaveBeenCalledWith('https://example.com/', { waitUntil: 'domcontentloaded' });
		expect(click.result).toMatchObject({ content: 'clicked', isError: undefined });
		expect(context.page.locator).toHaveBeenCalledWith('[data-agent-ref="e1"]');
		expect(context.page.click).toHaveBeenCalledTimes(1);
		expect(events).not.toContainEqual(expect.objectContaining({ type: 'tool_permission_request' }));
	} finally {
		await browser.close();
	}
});
