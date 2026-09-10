const attachWindowHandlers = jest.fn();

jest.mock('electron', () => ({ app: { focus: jest.fn() } }));
jest.mock('../../../../src/main/window_events', () => ({ attachWindowHandlers }));
jest.mock('../../../../src/main/translucency', () => ({
	getPlatformTranslucencyOptions: () => ({}),
}));

import { VoiceWindow } from '../../../../src/main/voice_window';

it('creates a standalone voice window that can be shown and hidden independently', () => {
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
	voiceWindow.end();

	expect(options).not.toHaveProperty('parent');
	expect(options).not.toHaveProperty('modal');
	expect(voiceWindow.isActive()).toBe(true);
	expect(win.close).toHaveBeenCalledTimes(1);
	expect(win.show).toHaveBeenCalledTimes(1);
	expect(attachWindowHandlers).toHaveBeenCalledWith(win);
});
