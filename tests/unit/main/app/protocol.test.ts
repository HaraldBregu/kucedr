import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';
import { app, BrowserWindow, desktopCapturer, dialog, net, protocol, session } from 'electron';
import { AppRegistry } from '../../../../src/main/apps/app_registry';
import { appsRoot } from '../../../../src/main/apps/app_root';
import {
	APP_RESOURCE_SCHEME,
	APP_SESSION_PARTITION,
	appResourceUrl,
	registerLocalResourceProtocolHandler,
	registerLocalResourceProtocolScheme,
	setupMediaPermissionHandlers,
} from '../../../../src/main/protocol';

describe('protocol security', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(fs, 'realpath').mockImplementation(async (value) => String(value));
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('denies absolute local files to app sessions', async () => {
		jest.mocked(net.fetch).mockResolvedValue(new Response('ok'));
		registerLocalResourceProtocolHandler({ error: jest.fn() });

		const mainHandler = jest.mocked(protocol.handle).mock.calls[0][1] as (
			request: Request
		) => Promise<Response>;
		const app = jest.mocked(session.fromPartition).mock.results[0].value as Electron.Session;
		const appHandler = jest.mocked(app.protocol.handle).mock.calls[0][1] as (
			request: Request
		) => Promise<Response>;
		const privatePath = '/tmp/kucedr-private.txt';
		const request = new Request(`local-resource://file${privatePath}`);

		await expect(appHandler(request)).resolves.toMatchObject({ status: 403 });
		expect(net.fetch).not.toHaveBeenCalled();

		await mainHandler(request);
		expect(net.fetch).toHaveBeenCalledWith(pathToFileURL(privatePath).toString(), {
			headers: request.headers,
		});
		expect(session.fromPartition).toHaveBeenCalledWith(APP_SESSION_PARTITION);
	});

	it('serves app resources only from the selected app folder', async () => {
		jest.mocked(net.fetch).mockResolvedValue(new Response('ok'));
		registerLocalResourceProtocolScheme();
		registerLocalResourceProtocolHandler({ error: jest.fn() });

		expect(protocol.registerSchemesAsPrivileged).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({
					scheme: APP_RESOURCE_SCHEME,
					privileges: expect.objectContaining({ secure: true, standard: true }),
				}),
			])
		);
		const app = jest.mocked(session.fromPartition).mock.results[0].value as Electron.Session;
		const appHandler = jest
			.mocked(app.protocol.handle)
			.mock.calls.find(([scheme]) => scheme === APP_RESOURCE_SCHEME)?.[1] as (
			request: Request
		) => Promise<Response>;
		const entry = path.join(appsRoot(), 'draw', 'index.html');
		const request = new Request(appResourceUrl(entry, 'draw'));

		await expect(appHandler(request)).resolves.toMatchObject({ status: 200 });
		expect(net.fetch).toHaveBeenCalledWith(pathToFileURL(entry).toString(), {
			headers: request.headers,
		});
		await expect(
			appHandler(new Request(`${APP_RESOURCE_SCHEME}://draw/..%2F..%2Fprivate.txt`))
		).resolves.toMatchObject({ status: 403 });
		expect(net.fetch).toHaveBeenCalledTimes(1);
	});

	it('keeps sensitive read and capture permissions out of app views', async () => {
		const appRegistry = new AppRegistry();
		const appContents = { id: 7, once: jest.fn() };
		appRegistry.register(appContents, 'workspace');
		const mainContents = { id: 8 };
		jest
			.mocked(BrowserWindow.fromWebContents)
			.mockImplementation((contents) =>
				contents === mainContents ? ({} as Electron.BrowserWindow) : null
			);
		setupMediaPermissionHandlers(appRegistry);

		const defaultSession = session.defaultSession;
		const check = jest.mocked(defaultSession.setPermissionCheckHandler).mock.calls[0][0];
		const mainUrl = pathToFileURL(
			path.join(app.getAppPath(), 'out/renderer/index.html')
		).toString();
		const details = {
			isMainFrame: true,
			mediaType: 'audio',
			requestingUrl: mainUrl,
			securityOrigin: 'file://',
		} as Electron.PermissionCheckHandlerHandlerDetails;

		expect(
			check(appContents as Electron.WebContents, 'clipboard-read', 'file://', details)
		).toBe(false);
		expect(
			check(
				appContents as Electron.WebContents,
				'clipboard-sanitized-write',
				'file://',
				details
			)
		).toBe(true);
		expect(check(appContents as Electron.WebContents, 'media', 'file://', details)).toBe(
			false
		);
		expect(check(mainContents as Electron.WebContents, 'media', 'file://', details)).toBe(true);

		const display = jest.mocked(defaultSession.setDisplayMediaRequestHandler).mock.calls[0][0];
		const denied = jest.fn();
		display(
			{ frame: { url: pathToFileURL('/tmp/app/index.html').toString(), top: null } } as never,
			denied
		);
		expect(denied).toHaveBeenCalledWith({});
		expect(desktopCapturer.getSources).not.toHaveBeenCalled();

		jest.mocked(desktopCapturer.getSources).mockResolvedValue([{ id: 'screen:1' }] as never);
		await new Promise<void>((resolve) => {
			const frame = { url: mainUrl, webContents: mainContents } as never;
			(frame as { top: unknown }).top = frame;
			display({ frame } as never, (result) => {
				expect(result).toEqual({ video: { id: 'screen:1' } });
				resolve();
			});
		});
	});

	it('asks the user when more than one source is available', async () => {
		const appRegistry = new AppRegistry();
		const mainContents = { id: 8 };
		jest.mocked(BrowserWindow.fromWebContents).mockReturnValue({} as Electron.BrowserWindow);
		setupMediaPermissionHandlers(appRegistry);
		const display = jest.mocked(session.defaultSession.setDisplayMediaRequestHandler).mock.calls.at(-1)?.[0];
		jest.mocked(desktopCapturer.getSources).mockResolvedValue([
			{ id: 'screen:1', name: 'Display 1' },
			{ id: 'screen:2', name: 'Display 2' },
		] as never);
		jest.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 1 } as never);
		const callback = jest.fn();
		const frame = {
			url: pathToFileURL(path.join(app.getAppPath(), 'out/renderer/index.html')).toString(),
			webContents: mainContents,
		} as never;
		(frame as { top: unknown }).top = frame;
		display?.({ frame } as never, callback);
		await new Promise((resolve) => setImmediate(resolve));
		expect(dialog.showMessageBox).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ buttons: ['Display 1', 'Display 2', 'Cancel'] })
		);
		expect(callback).toHaveBeenCalledWith({ video: { id: 'screen:2', name: 'Display 2' } });
	});

	it('returns an empty grant for source cancellation and unavailable capture infrastructure', async () => {
		const appRegistry = new AppRegistry();
		const mainContents = { id: 8 };
		jest.mocked(BrowserWindow.fromWebContents).mockReturnValue({} as Electron.BrowserWindow);
		setupMediaPermissionHandlers(appRegistry);
		const display = jest.mocked(session.defaultSession.setDisplayMediaRequestHandler).mock.calls.at(-1)?.[0];
		const frame = {
			url: pathToFileURL(path.join(app.getAppPath(), 'out/renderer/index.html')).toString(),
			webContents: mainContents,
		} as never;
		(frame as { top: unknown }).top = frame;
		jest.mocked(desktopCapturer.getSources).mockResolvedValue([]);
		const unavailable = jest.fn();
		display?.({ frame } as never, unavailable);
		await new Promise((resolve) => setImmediate(resolve));
		expect(unavailable).toHaveBeenCalledWith({});

		jest.mocked(desktopCapturer.getSources).mockResolvedValue([
			{ id: 'screen:1', name: 'Display 1' },
			{ id: 'screen:2', name: 'Display 2' },
		] as never);
		jest.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 2 } as never);
		const cancelled = jest.fn();
		display?.({ frame } as never, cancelled);
		await new Promise((resolve) => setImmediate(resolve));
		expect(cancelled).toHaveBeenCalledWith({});
	});
});
