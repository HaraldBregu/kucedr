const attachWindowHandlers = jest.fn();
jest.mock('../../../../src/main/window_events', () => ({ attachWindowHandlers }));
import { CoderWindow } from '../../../../src/main/coder';

it('opens a standalone Coder renderer, reuses it, and recreates it after closing', () => {
	const listeners = new Map<string, () => void>();
	const win = {
		isDestroyed: jest.fn(() => false),
		restore: jest.fn(), show: jest.fn(), focus: jest.fn(),
		on: jest.fn((event, callback) => listeners.set(event, callback)),
		once: jest.fn((event, callback) => listeners.set(event, callback)),
	};
	const factory = { create: jest.fn((_options: unknown, _content: unknown) => win) };
	const contexts = { create: jest.fn() };
	const coder = new CoderWindow(factory as never, contexts as never);
	coder.open();
	expect(factory.create).toHaveBeenCalledWith(
		expect.objectContaining({ title: 'Coder', width: 1280, height: 800 }),
		{ html: 'coder.html' }
	);
	expect(factory.create.mock.calls[0]?.[0]).not.toHaveProperty('parent');
	listeners.get('ready-to-show')?.();
	coder.open();
	expect(factory.create).toHaveBeenCalledTimes(1);
	expect(win.show).toHaveBeenCalledTimes(2);
	expect(contexts.create).toHaveBeenCalledWith(win);
	expect(attachWindowHandlers).toHaveBeenCalledWith(win);
	listeners.get('closed')?.();
	coder.open();
	expect(factory.create).toHaveBeenCalledTimes(2);
});
