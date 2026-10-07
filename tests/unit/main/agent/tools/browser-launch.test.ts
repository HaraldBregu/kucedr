import { EventEmitter } from 'node:events';

const launchPersistentContext = jest.fn();
const connectOverCDP = jest.fn();

jest.mock('playwright-core', () => ({
	chromium: { launchPersistentContext, connectOverCDP },
}));

import { useWebBrowserTool } from '../../../../../src/main/agent/tools/web/use_web_browser';

function personalBrowser() {
	const page = Object.assign(new EventEmitter(), {
		url: () => 'https://existing.example/',
		title: async () => 'Existing tab',
		close: jest.fn(),
		goto: jest.fn(async () => undefined),
	});
	const context = Object.assign(new EventEmitter(), {
		pages: () => [page],
		setDefaultTimeout: jest.fn(),
		close: jest.fn(),
	});
	const browser = {
		contexts: () => [context],
		close: jest.fn(async () => { context.emit('close'); }),
	};
	connectOverCDP.mockResolvedValue(browser);
	return { browser, context, page };
}

beforeEach(() => {
	connectOverCDP.mockReset();
	launchPersistentContext.mockReset();
});

afterEach(async () => {
	await useWebBrowserTool.run({ action: 'stop' });
});

it('attaches to existing tabs, reuses the connection and disconnects without closing Chrome', async () => {
	const { browser, context, page } = personalBrowser();
	const [result] = await Promise.all([
		useWebBrowserTool.run({ action: 'start' }),
		useWebBrowserTool.run({ action: 'start' }),
	]);
	expect(JSON.parse(String(result))).toMatchObject({
		running: true,
		tabs: [{ url: 'https://existing.example/', title: 'Existing tab' }],
	});
	expect(connectOverCDP).toHaveBeenCalledTimes(1);
	expect(connectOverCDP).toHaveBeenCalledWith('chrome', {
		noDefaults: true, headers: { 'User-Agent': 'Kucedr' }, timeout: 60_000,
	});
	expect(launchPersistentContext).not.toHaveBeenCalled();
	await useWebBrowserTool.run({ action: 'navigate', url: 'https://next.example/' });
	expect(page.goto).toHaveBeenCalledWith('https://next.example/', { waitUntil: 'domcontentloaded' });
	await useWebBrowserTool.run({ action: 'stop' });
	expect(browser.close).toHaveBeenCalledTimes(1);
	expect(context.close).not.toHaveBeenCalled();
	expect(page.close).not.toHaveBeenCalled();
	expect(JSON.parse(String(await useWebBrowserTool.run({ action: 'status' })))).toEqual({ running: false, tabs: [] });
	await useWebBrowserTool.run({ action: 'start' });
	expect(connectOverCDP).toHaveBeenCalledTimes(2);
});

it('explains Chrome setup after connection failure and allows retrying', async () => {
	personalBrowser();
	connectOverCDP.mockRejectedValueOnce(new Error('DevToolsActivePort file not found'));
	await expect(useWebBrowserTool.run({ action: 'start' })).rejects.toThrow('chrome://inspect/#remote-debugging');
	await useWebBrowserTool.run({ action: 'start' });
	expect(connectOverCDP).toHaveBeenCalledTimes(2);
	expect(launchPersistentContext).not.toHaveBeenCalled();
});

it('disconnects after cancellation during attachment without closing personal tabs', async () => {
	const { browser, context, page } = personalBrowser();
	let resolveConnection!: (value: typeof browser) => void;
	connectOverCDP.mockReturnValue(new Promise((resolve) => { resolveConnection = resolve; }));
	const controller = new AbortController();
	const start = useWebBrowserTool.run({ action: 'start' }, controller.signal);
	const result = expect(start).rejects.toThrow('cancel browser');
	controller.abort(new Error('cancel browser'));
	resolveConnection(browser);
	await result;
	expect(browser.close).toHaveBeenCalledTimes(1);
	expect(context.close).not.toHaveBeenCalled();
	expect(page.close).not.toHaveBeenCalled();
});

it('disconnects to cancel navigation without closing the personal tab', async () => {
	const { browser, context, page } = personalBrowser();
	await useWebBrowserTool.run({ action: 'start' });
	let rejectNavigation!: (error: Error) => void;
	page.goto.mockReturnValue(new Promise((_, reject) => { rejectNavigation = reject; }));
	browser.close.mockImplementation(async () => {
		context.emit('close');
		rejectNavigation(new Error('disconnected'));
	});
	const controller = new AbortController();
	const navigation = useWebBrowserTool.run({ action: 'navigate', url: 'https://next.example/' }, controller.signal);
	const result = expect(navigation).rejects.toThrow('disconnected');
	controller.abort(new Error('cancel browser'));
	await result;
	expect(browser.close).toHaveBeenCalledTimes(1);
	expect(page.close).not.toHaveBeenCalled();
	expect(context.close).not.toHaveBeenCalled();
});


it('disconnects a pending attachment before reporting that the browser stopped', async () => {
	const { browser, context, page } = personalBrowser();
	let resolveConnection!: (value: typeof browser) => void;
	connectOverCDP.mockReturnValue(new Promise((resolve) => { resolveConnection = resolve; }));
	const start = useWebBrowserTool.run({ action: 'start' });
	const stop = useWebBrowserTool.run({ action: 'stop' });
	resolveConnection(browser);
	await Promise.all([start, stop]);
	expect(browser.close).toHaveBeenCalledTimes(1);
	expect(context.close).not.toHaveBeenCalled();
	expect(page.close).not.toHaveBeenCalled();
	expect(JSON.parse(String(await useWebBrowserTool.run({ action: 'status' })))).toEqual({ running: false, tabs: [] });
});
