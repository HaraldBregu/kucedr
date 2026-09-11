const attachWindowHandlers = jest.fn();

jest.mock('electron', () => ({ app: { focus: jest.fn() } }));
jest.mock('../../../../src/main/window_events', () => ({ attachWindowHandlers }));
jest.mock('../../../../src/main/translucency', () => ({
	getPlatformTranslucencyOptions: () => ({}),
}));

import { VoiceWindow } from '../../../../src/main/voice_window';

it('keeps a standalone voice conversation active while its window is hidden', () => {
	let visible = false;
	const listeners = new Map<string, () => void>();
	const win = {
		id: 12,
		webContents: {},
		isDestroyed: jest.fn(() => false),
		isVisible: jest.fn(() => visible),
		show: jest.fn(() => {
			visible = true;
		}),
		hide: jest.fn(() => {
			visible = false;
		}),
		close: jest.fn(),
		restore: jest.fn(),
		moveTop: jest.fn(),
		focus: jest.fn(),
		on: jest.fn((event: string, listener: () => void) => {
			listeners.set(event, listener);
		}),
		once: jest.fn((event: string, listener: () => void) => {
			listeners.set(event, listener);
		}),
		setBackgroundColor: jest.fn(),
		setWindowButtonVisibility: jest.fn(),
		setAlwaysOnTop: jest.fn(),
		setVisibleOnAllWorkspaces: jest.fn(),
	};
	const windowFactory = {
		create: jest.fn(() => win),
	} as never;
	const windowContextManager = { create: jest.fn() } as never;
	const voiceWindow = new VoiceWindow(windowFactory, windowContextManager);

	voiceWindow.open('chat-session');
	const options = (windowFactory.create as jest.Mock).mock.calls[0]?.[0];
	listeners.get('ready-to-show')?.();
	voiceWindow.hide();
	voiceWindow.show();

	expect(options).not.toHaveProperty('parent');
	expect(options).not.toHaveProperty('modal');
	expect(options).toHaveProperty('alwaysOnTop', true);
	expect(voiceWindow.isActive()).toBe(true);
	expect(voiceWindow.isVisible()).toBe(true);
	expect(win.hide).toHaveBeenCalledTimes(1);
	expect(win.close).not.toHaveBeenCalled();
	expect(win.show).toHaveBeenCalledTimes(2);
	expect(win.focus).toHaveBeenCalledTimes(1);
	expect(win.setAlwaysOnTop).toHaveBeenCalledWith(true, 'floating');
	expect(win.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true, {
		visibleOnFullScreen: true,
	});
	expect(listeners.has('blur')).toBe(false);
	expect(attachWindowHandlers).toHaveBeenCalledWith(win);
});
