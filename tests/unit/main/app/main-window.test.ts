const attachWindowHandlers = jest.fn();

jest.mock('../../../../src/main/window_events', () => ({ attachWindowHandlers }));
jest.mock('../../../../src/main/translucency', () => ({
	getPlatformTranslucencyOptions: () => ({}),
}));

import { Main } from '../../../../src/main/create_window';

function createWindow() {
	const listeners = new Map<string, (...args: never[]) => void>();
	const win = {
		id: 12,
		isDestroyed: jest.fn(() => false),
		isVisible: jest.fn(() => true),
		setBackgroundColor: jest.fn(),
		setMenuBarVisibility: jest.fn(),
		autoHideMenuBar: true,
		show: jest.fn(),
		webContents: {
			navigationHistory: {
				canGoBack: jest.fn(() => true),
				canGoForward: jest.fn(() => true),
				goBack: jest.fn(),
				goForward: jest.fn(),
			},
		},
		on: jest.fn((event: string, listener: (...args: never[]) => void) => {
			listeners.set(event, listener);
		}),
		once: jest.fn((event: string, listener: (...args: never[]) => void) => {
			listeners.set(event, listener);
		}),
	};
	return { listeners, win };
}

it('shows the native menu bar when the main window gains focus', () => {
	const { listeners, win } = createWindow();
	const windowFactory = { create: jest.fn(() => win) };
	const main = new Main(
		{ isQuitting: false } as never,
		windowFactory as never,
		{ create: jest.fn() } as never
	);

	main.create();
	listeners.get('focus')?.();
	listeners.get('blur')?.();

	expect(windowFactory.create).toHaveBeenCalledWith(
		expect.objectContaining({ width: 900 }),
		expect.objectContaining({ hash: 'start' })
	);
	expect(win.setMenuBarVisibility).toHaveBeenCalledWith(true);
	expect(win.setMenuBarVisibility).not.toHaveBeenCalledWith(false);
	expect(win.autoHideMenuBar).toBe(false);
});

it('moves through route history for mouse back and forward commands', () => {
	const { listeners, win } = createWindow();
	const main = new Main(
		{ isQuitting: false } as never,
		{ create: jest.fn(() => win) } as never,
		{ create: jest.fn() } as never
	);

	main.create();
	listeners.get('app-command')?.({} as never, 'browser-backward' as never);
	listeners.get('app-command')?.({} as never, 'browser-forward' as never);

	expect(win.webContents.navigationHistory.goBack).toHaveBeenCalledTimes(1);
	expect(win.webContents.navigationHistory.goForward).toHaveBeenCalledTimes(1);
});

it('does not navigate beyond route history', () => {
	const { listeners, win } = createWindow();
	win.webContents.navigationHistory.canGoBack.mockReturnValue(false);
	win.webContents.navigationHistory.canGoForward.mockReturnValue(false);
	const main = new Main(
		{ isQuitting: false } as never,
		{ create: jest.fn(() => win) } as never,
		{ create: jest.fn() } as never
	);

	main.create();
	listeners.get('app-command')?.({} as never, 'browser-backward' as never);
	listeners.get('app-command')?.({} as never, 'browser-forward' as never);

	expect(win.webContents.navigationHistory.goBack).not.toHaveBeenCalled();
	expect(win.webContents.navigationHistory.goForward).not.toHaveBeenCalled();
});
