const attachWindowHandlers = jest.fn();

jest.mock('../../../../src/main/window_events', () => ({ attachWindowHandlers }));
jest.mock('../../../../src/main/translucency', () => ({
	getPlatformTranslucencyOptions: () => ({}),
}));

import { Main } from '../../../../src/main/create_window';

it('shows the native menu bar when the main window gains focus', () => {
	const listeners = new Map<string, () => void>();
	const win = {
		id: 12,
		isDestroyed: jest.fn(() => false),
		isVisible: jest.fn(() => true),
		setBackgroundColor: jest.fn(),
		setMenuBarVisibility: jest.fn(),
		autoHideMenuBar: true,
		show: jest.fn(),
		on: jest.fn((event: string, listener: () => void) => {
			listeners.set(event, listener);
		}),
		once: jest.fn((event: string, listener: () => void) => {
			listeners.set(event, listener);
		}),
	};
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
