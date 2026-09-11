import { BrowserWindow, WebContentsView } from 'electron';
import { AppRegistry } from '../../../../src/main/apps/app_registry';
import { appsRoot } from '../../../../src/main/apps/app_root';
import {
	APP_RESOURCE_SCHEME,
	APP_SESSION_PARTITION,
} from '../../../../src/main/protocol';
import { WindowFactory } from '../../../../src/main/window_factory';
import path from 'node:path';

it('keeps the application menu visible on every native window', () => {
	const contents = {
		on: jest.fn(),
		setWindowOpenHandler: jest.fn(),
	};
	const win = {
		setMenuBarVisibility: jest.fn(),
		webContents: contents,
	};
	(BrowserWindow as unknown as jest.Mock).mockImplementationOnce(() => win);
	const factory = new WindowFactory(undefined, new AppRegistry());

	factory.create();

	expect(BrowserWindow).toHaveBeenCalledWith(
		expect.objectContaining({ autoHideMenuBar: false })
	);
	expect(win.setMenuBarVisibility).toHaveBeenCalledWith(true);
});

it('registers an app view before loading and removes it when destroyed', async () => {
	const handlers = new Map<string, () => void>();
	const contents = {
		id: 9,
		loadURL: jest.fn(async () => undefined),
		on: jest.fn(),
		once: jest.fn((event: string, handler: () => void) => handlers.set(event, handler)),
		setWindowOpenHandler: jest.fn(),
	};
	(WebContentsView as unknown as jest.Mock).mockImplementation(() => ({ webContents: contents }));
	const registry = new AppRegistry();
	const factory = new WindowFactory(undefined, registry);

	const app = factory.createView(path.join(appsRoot(), 'draw/index.html'), 'draw');
	expect(WebContentsView).toHaveBeenCalledWith({
		webPreferences: expect.objectContaining({ partition: APP_SESSION_PARTITION }),
	});
	expect(registry.resolve(contents)).toBe('draw');
	expect(contents.loadURL).not.toHaveBeenCalled();

	await app.load();
	expect(contents.loadURL).toHaveBeenCalledWith(`${APP_RESOURCE_SCHEME}://draw/index.html`);
	handlers.get('destroyed')?.();
	expect(() => registry.resolve(contents)).toThrow('registered app views');
});
