import type { BrowserWindow, WebContentsView } from 'electron';
import { closeApp } from '../../../../src/main/apps/app_close';
import { openAppWindows, render } from '../../../../src/main/apps/app_render';
import type { WindowFactory } from '../../../../src/main/window_factory';

jest.mock('../../../../src/main/translucency', () => ({
	getPlatformTranslucencyOptions: jest.fn(() => ({
		vibrancy: 'under-window',
		visualEffectState: 'followWindow',
	})),
}));

type Handler = (...args: unknown[]) => void;

function createHarness() {
	const handlers = new Map<string, Handler>();
	const shellHandlers = new Map<string, Handler>();
	const viewHandlers = new Map<string, Handler>();
	let resolveLoad!: () => void;
	let rejectLoad!: (error: Error) => void;
	const loaded = new Promise<void>((resolve, reject) => {
		resolveLoad = resolve;
		rejectLoad = reject;
	});
	const shellWebContents = {
		isDestroyed: jest.fn(() => false),
		on: jest.fn((event: string, handler: Handler) => shellHandlers.set(event, handler)),
		once: jest.fn((event: string, handler: Handler) => shellHandlers.set(event, handler)),
		send: jest.fn(),
	};
	const viewWebContents = {
		close: jest.fn(),
		isDestroyed: jest.fn(() => false),
		on: jest.fn((event: string, handler: Handler) => viewHandlers.set(event, handler)),
		once: jest.fn((event: string, handler: Handler) => viewHandlers.set(event, handler)),
		send: jest.fn(),
	};
	const view = {
		setBounds: jest.fn(),
		setVisible: jest.fn(),
		webContents: viewWebContents,
	} as unknown as WebContentsView;
	const win = {
		close: jest.fn(),
		contentView: { addChildView: jest.fn() },
		destroy: jest.fn(),
		focus: jest.fn(),
		getContentBounds: jest.fn(() => ({ x: 0, y: 0, width: 820, height: 640 })),
		isDestroyed: jest.fn(() => false),
		isMinimized: jest.fn(() => false),
		isVisible: jest.fn(() => false),
		once: jest.fn((event: string, handler: Handler) => handlers.set(event, handler)),
		on: jest.fn((event: string, handler: Handler) => handlers.set(event, handler)),
		restore: jest.fn(),
		setMenuBarVisibility: jest.fn(),
		setTitle: jest.fn(),
		show: jest.fn(),
		webContents: shellWebContents,
	} as unknown as BrowserWindow;
	const create = jest.fn(() => win);
	const load = jest.fn(() => loaded);
	const createView = jest.fn(() => ({ view, load }));
	const windowFactory = { create, createView } as unknown as WindowFactory;

	return {
		create,
		createView,
		handlers,
		load,
		rejectLoad,
		resolveLoad,
		shellHandlers,
		view,
		viewHandlers,
		viewWebContents,
		win,
		windowFactory,
	};
}

describe('app renderer', () => {
	it('loads the titlebar shell before attaching and loading app content', async () => {
		const harness = createHarness();

		expect(render(harness.windowFactory, '/app/index.html', 'Project', 'project-order')).toBe(
			harness.win
		);
		expect(harness.create).toHaveBeenCalledWith(
			expect.objectContaining({
				frame: false,
				resizable: true,
				title: 'Project',
				transparent: true,
				vibrancy: 'under-window',
				visualEffectState: 'followWindow',
			}),
			{ html: 'app.html', hash: 'app/Project' }
		);
		expect(harness.create.mock.calls[0]?.[0]).not.toHaveProperty('autoHideMenuBar');
		expect(harness.win.setMenuBarVisibility).not.toHaveBeenCalled();
		expect(harness.createView).not.toHaveBeenCalled();

		harness.handlers.get('ready-to-show')?.();
		expect(harness.win.show).not.toHaveBeenCalled();

		harness.shellHandlers.get('did-finish-load')?.();
		expect(harness.createView).toHaveBeenCalledWith('/app/index.html', 'project-order');
		expect(harness.view.setVisible).toHaveBeenCalledWith(false);
		expect(harness.win.contentView.addChildView).toHaveBeenCalledWith(harness.view);
		expect(harness.view.setBounds).toHaveBeenCalledWith({
			x: 0,
			y: 48,
			width: 820,
			height: 592,
		});
		expect(harness.load).toHaveBeenCalledTimes(1);
		expect(openAppWindows.get('project-order')).toMatchObject({
			contents: harness.viewWebContents,
			titlebarOptions: null,
		});
		expect(harness.win.contentView.addChildView.mock.invocationCallOrder[0]).toBeLessThan(
			harness.load.mock.invocationCallOrder[0]
		);
		expect(harness.win.show).not.toHaveBeenCalled();

		harness.resolveLoad();
		await new Promise((resolve) => setImmediate(resolve));
		expect(harness.view.setVisible).toHaveBeenLastCalledWith(true);
		expect(harness.win.show).toHaveBeenCalledTimes(1);

		const titleEvent = { preventDefault: jest.fn() };
		harness.shellHandlers.get('page-title-updated')?.(titleEvent);
		expect(titleEvent.preventDefault).toHaveBeenCalledTimes(1);
		expect(harness.win.setTitle).toHaveBeenCalledWith('Project');

		harness.handlers.get('closed')?.();
		expect(openAppWindows.has('project-order')).toBe(false);
	});

	it('keeps a failed app view hidden and closes its shell', async () => {
		const harness = createHarness();
		render(harness.windowFactory, '/app/index.html', 'Project', 'project-failure');

		harness.handlers.get('ready-to-show')?.();
		harness.shellHandlers.get('did-finish-load')?.();
		harness.rejectLoad(new Error('load failed'));
		await new Promise((resolve) => setImmediate(resolve));

		expect(harness.view.setVisible).not.toHaveBeenCalledWith(true);
		expect(harness.win.show).not.toHaveBeenCalled();
		expect(harness.win.close).toHaveBeenCalledTimes(1);
		harness.handlers.get('closed')?.();
	});

	it('discards a crashed titlebar shell so the app can be opened again', () => {
		const harness = createHarness();
		render(harness.windowFactory, '/app/index.html', 'Project', 'project-crash');

		harness.shellHandlers.get('render-process-gone')?.();
		expect(harness.win.destroy).toHaveBeenCalledTimes(1);

		render(harness.windowFactory, '/app/index.html', 'Project', 'project-crash');
		expect(harness.create).toHaveBeenCalledTimes(2);
		harness.handlers.get('closed')?.();
	});

	it('lets the app finish before closing the titlebar shell', () => {
		const harness = createHarness();
		render(harness.windowFactory, '/app/index.html', 'Project', 'project-close');
		const closeEvent = { preventDefault: jest.fn() };

		harness.handlers.get('close')?.(closeEvent);
		expect(closeEvent.preventDefault).not.toHaveBeenCalled();

		harness.shellHandlers.get('did-finish-load')?.();
		harness.handlers.get('close')?.(closeEvent);
		harness.handlers.get('close')?.(closeEvent);
		expect(closeEvent.preventDefault).toHaveBeenCalledTimes(2);
		expect(harness.viewWebContents.close).toHaveBeenCalledTimes(1);
		expect(harness.viewWebContents.close).toHaveBeenCalledWith({ waitForBeforeUnload: true });

		harness.viewHandlers.get('will-prevent-unload')?.();
		harness.handlers.get('close')?.(closeEvent);
		expect(harness.viewWebContents.close).toHaveBeenCalledTimes(2);

		harness.viewWebContents.isDestroyed.mockReturnValue(true);
		harness.viewHandlers.get('destroyed')?.();
		expect(harness.win.close).toHaveBeenCalledTimes(1);
		harness.handlers.get('close')?.(closeEvent);
		expect(closeEvent.preventDefault).toHaveBeenCalledTimes(3);
		expect(() => harness.handlers.get('closed')?.()).not.toThrow();
		expect(harness.viewWebContents.close).toHaveBeenCalledTimes(2);
	});

	it('requests closing a tracked app and forgets it once closed', () => {
		const harness = createHarness();
		render(harness.windowFactory, '/app/index.html', 'Project', 'project-request-close');

		expect(closeApp('project-request-close')).toBe(true);
		expect(harness.win.close).toHaveBeenCalledTimes(1);

		harness.handlers.get('closed')?.();
		expect(closeApp('project-request-close')).toBe(false);
		expect(harness.win.close).toHaveBeenCalledTimes(1);
	});

	it('does not close missing or destroyed app windows', () => {
		const harness = createHarness();
		render(harness.windowFactory, '/app/index.html', 'Project', 'project-destroyed');
		harness.win.isDestroyed = jest.fn(() => true);

		expect(closeApp('missing')).toBe(false);
		expect(closeApp('project-destroyed')).toBe(false);
		expect(harness.win.close).not.toHaveBeenCalled();
	});
});
