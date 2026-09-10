import {
	app,
	BrowserWindow,
	desktopCapturer,
	dialog,
	net,
	protocol,
	session,
	systemPreferences,
	webContents,
} from 'electron';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveWorkspaceFile } from './ipc/workspace';
import { agentLocation } from './shared/agent_location';
import type { LoggerService } from './shared';
import type { AppRegistry } from './apps/app_registry';
import { appsRoot } from './apps/app_root';
import { isAppId } from './apps/app_id';

const LOCAL_RESOURCE_SCHEME = 'local-resource';
export const APP_RESOURCE_SCHEME = 'kucedr-app';
export const APP_SESSION_PARTITION = 'persist:kucedr-apps';

export function registerLocalResourceProtocolScheme(): void {
	protocol.registerSchemesAsPrivileged([
		{
			scheme: LOCAL_RESOURCE_SCHEME,
			privileges: {
				standard: true,
				secure: true,
				bypassCSP: true,
				supportFetchAPI: true,
				stream: true,
			},
		},
		{
			scheme: APP_RESOURCE_SCHEME,
			privileges: {
				standard: true,
				secure: true,
				corsEnabled: true,
				supportFetchAPI: true,
				stream: true,
			},
		},
	]);
}

export function appResourceUrl(file: string, appId: string): string {
	if (!isAppId(appId)) throw new Error('Invalid app ID.');
	const root = path.resolve(appsRoot(), appId);
	const target = path.resolve(file);
	const relative = path.relative(root, target);
	if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
		throw new Error('App entry resolves outside its folder.');
	}
	const url = new URL(`${APP_RESOURCE_SCHEME}://${appId}`);
	url.pathname = `/${relative.split(path.sep).join('/')}`;
	return url.toString();
}

export function registerLocalResourceProtocolHandler(logger: Pick<LoggerService, 'error'>): void {
	const handler =
		(allowAbsolutePaths: boolean) =>
		async (request: Request): Promise<Response> => {
			try {
				const url = new URL(request.url);
				if (url.host !== 'agent' && (url.host !== 'file' || !allowAbsolutePaths)) {
					return new Response(null, { status: 403 });
				}
				let pathname = decodeURIComponent(url.pathname);
				if (url.host === 'agent') {
					pathname = await resolveWorkspaceFile(agentLocation(), pathname.replace(/^\/+/, ''));
				} else if (process.platform === 'win32' && /^\/[A-Za-z]:/.test(pathname)) {
					pathname = pathname.slice(1);
				}
				// Forward headers so media Range requests get 206 responses for seeking.
				return await net.fetch(pathToFileURL(pathname).toString(), {
					headers: request.headers,
				});
			} catch (err) {
				logger.error('App', `${LOCAL_RESOURCE_SCHEME} fetch failed for ${request.url}`, err);
				return new Response(null, { status: 500 });
			}
		};

	protocol.handle(LOCAL_RESOURCE_SCHEME, handler(true));
	const appSession = session.fromPartition(APP_SESSION_PARTITION);
	appSession.protocol.handle(LOCAL_RESOURCE_SCHEME, handler(false));
	appSession.protocol.handle(APP_RESOURCE_SCHEME, async (request) => {
		try {
			const url = new URL(request.url);
			if (!isAppId(url.host)) return new Response(null, { status: 403 });
			const root = path.resolve(appsRoot(), url.host);
			const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
			const target = path.resolve(root, pathname);
			const lexicalRelative = path.relative(root, target);
			if (
				!pathname ||
				lexicalRelative.startsWith(`..${path.sep}`) ||
				path.isAbsolute(lexicalRelative)
			) {
				return new Response(null, { status: 403 });
			}
			const resolvedRoot = await fs.realpath(root);
			const resolvedTarget = await fs.realpath(target);
			const relative = path.relative(resolvedRoot, resolvedTarget);
			if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
				return new Response(null, { status: 403 });
			}
			return await net.fetch(pathToFileURL(resolvedTarget).toString(), {
				headers: request.headers,
			});
		} catch (err) {
			logger.error('Apps', `App resource fetch failed for ${request.url}`, err);
			return new Response(null, { status: 404 });
		}
	});
}

export function setupMediaPermissionHandlers(appRegistry: AppRegistry): void {
	const configure = (targetSession: Electron.Session, allowDisplayCapture: boolean): void => {
		targetSession.setPermissionCheckHandler(
			(webContents, permission, requestingOrigin, details) => {
				const isAppContents = isAppWindowWebContents(webContents, appRegistry);
				if (permission === 'fullscreen')
					return Boolean(webContents && appRegistry.has(webContents));
				if (permission === 'clipboard-read' || permission === 'clipboard-sanitized-write') {
					return Boolean(
						details.isMainFrame &&
						(permission === 'clipboard-sanitized-write'
							? isAppContents
							: webContents &&
								!appRegistry.has(webContents) &&
								BrowserWindow.fromWebContents(webContents)) &&
						isTrustedMediaRequestSource(
							requestingOrigin,
							details.requestingUrl,
							details.securityOrigin
						)
					);
				}
				if (permission !== 'media') return false;
				if (details.mediaType !== 'audio' && details.mediaType !== 'video') return false;
				if (!details.isMainFrame) return false;
				if (webContents && appRegistry.has(webContents)) return false;
				if (!webContents || !BrowserWindow.fromWebContents(webContents)) return false;
				return isTrustedMediaRequestSource(
					requestingOrigin,
					details.requestingUrl,
					details.securityOrigin
				);
			}
		);

		targetSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
			if (permission === 'fullscreen') {
				callback(Boolean(webContents && appRegistry.has(webContents)));
				return;
			}
			if (permission === 'clipboard-read' || permission === 'clipboard-sanitized-write') {
				callback(
					Boolean(
						details.isMainFrame &&
						(permission === 'clipboard-sanitized-write'
							? isAppWindowWebContents(webContents, appRegistry)
							: webContents &&
								!appRegistry.has(webContents) &&
								BrowserWindow.fromWebContents(webContents)) &&
						isTrustedMediaRequestSource(undefined, details.requestingUrl, undefined)
						)
					);
					return;
				}
				if (permission === 'display-capture') {
					const displayDetails = details as Electron.PermissionRequest;
					callback(
						Boolean(
							allowDisplayCapture &&
								displayDetails.isMainFrame &&
								!appRegistry.has(webContents) &&
								webContents &&
								BrowserWindow.fromWebContents(webContents) &&
								isTrustedMediaRequestSource(undefined, displayDetails.requestingUrl, undefined)
						)
					);
					return;
				}
				if (permission !== 'media') {
					callback(false);
					return;
				}

				const mediaDetails = details as Electron.MediaAccessPermissionRequest;
				const requestsAudio = mediaDetails.mediaTypes?.includes('audio') ?? false;
				const requestsVideo = mediaDetails.mediaTypes?.includes('video') ?? false;
				const requestsDisplayCapture = mediaDetails.mediaTypes?.length === 0;
				const allowed =
					(requestsAudio || requestsVideo || (allowDisplayCapture && requestsDisplayCapture)) &&
				mediaDetails.isMainFrame &&
				!appRegistry.has(webContents) &&
				Boolean(webContents && BrowserWindow.fromWebContents(webContents)) &&
				isTrustedMediaRequestSource(
					undefined,
					mediaDetails.requestingUrl,
					mediaDetails.securityOrigin
				);

			callback(allowed);
		});

		targetSession.setDisplayMediaRequestHandler(
			(request, callback) => {
				const frame = request.frame;
				const requestContents = frame ? webContents.fromFrame(frame) : undefined;
				const parentWindow = requestContents
					? BrowserWindow.fromWebContents(requestContents)
					: null;
				const trusted = Boolean(
					allowDisplayCapture &&
					frame &&
					frame === frame.top &&
					requestContents &&
					parentWindow &&
					isTrustedAppRendererUrl(frame.url)
				);
				if (!trusted) {
					callback({});
					return;
				}
				if (process.platform === 'darwin') {
					let status: string = 'unknown';
					try {
						status = systemPreferences.getMediaAccessStatus('screen');
					} catch {
						status = 'unknown';
					}
					if (status === 'denied' || status === 'restricted') {
						callback({});
						showDisplayCaptureMessage(parentWindow, {
							type: 'error',
							title: 'Screen Recording Permission Required',
							message: 'Kucedr cannot access the screen.',
							detail:
								'Open System Settings → Privacy & Security → Screen Recording, enable Kucedr, then fully quit and relaunch the packaged app.',
							buttons: ['OK'],
						});
						return;
					}
				}
				desktopCapturer
					.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } })
					.then((sources) => {
						if (sources.length === 0) {
							callback({});
							showDisplayCaptureMessage(parentWindow, {
								type: 'error',
								title: 'Desktop Capture Unavailable',
								message: 'Kucedr could not find a display or window to record.',
								detail:
									process.platform === 'linux'
										? 'On Wayland, ensure PipeWire and xdg-desktop-portal are running and that your desktop portal supports screen sharing. On X11, retry after confirming that a display is available.'
										: 'Close other capture sessions and try again.',
								buttons: ['OK'],
							});
							return;
						}
						if (sources.length === 1) {
							callback({ video: sources[0] });
							return;
						}
						const picker = {
							type: 'question' as const,
							title: 'Choose a screen to record',
							message: 'Select the display or window to capture.',
							buttons: [...sources.map((source) => source.name || 'Untitled source'), 'Cancel'],
							cancelId: sources.length,
							noLink: true,
						};
						void (
							parentWindow
								? dialog.showMessageBox(parentWindow, picker)
								: dialog.showMessageBox(picker)
						)
							.then(({ response }) => {
								callback(
									response >= 0 && response < sources.length ? { video: sources[response] } : {}
								);
							})
							.catch(() => callback({}));
					})
					.catch(() => {
						callback({});
						showDisplayCaptureMessage(parentWindow, {
							type: 'error',
							title: 'Desktop Capture Unavailable',
							message: 'Kucedr could not access desktop capture.',
							detail:
								process.platform === 'linux'
									? 'On Wayland, check PipeWire and xdg-desktop-portal. On X11, verify that the desktop session exposes the display to Electron.'
									: 'Check the operating system screen-capture permission and try again.',
							buttons: ['OK'],
						});
					});
			},
			{
				useSystemPicker:
					app.isPackaged &&
					process.platform === 'darwin' &&
					(() => {
						try {
							return Number.parseInt(process.getSystemVersion(), 10) >= 15;
						} catch {
							return false;
						}
					})(),
			}
		);
	};

	configure(session.defaultSession, true);
	configure(session.fromPartition(APP_SESSION_PARTITION), false);
}

function rendererDevOrigin(): string | null {
	const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
	if (!rendererUrl) return null;

	try {
		return new URL(rendererUrl).origin;
	} catch {
		return null;
	}
}

function isTrustedRendererOrigin(origin?: string): boolean {
	if (!origin) return false;
	if (origin === 'file://') return true;
	try {
		if (new URL(origin).protocol === `${APP_RESOURCE_SCHEME}:`) return true;
	} catch {
		return false;
	}
	const devOrigin = rendererDevOrigin();
	return Boolean(devOrigin && origin === devOrigin);
}

function isTrustedRendererUrl(url?: string): boolean {
	if (!url) return false;
	if (url.startsWith('file://')) return true;

	try {
		const parsed = new URL(url);
		return parsed.protocol === `${APP_RESOURCE_SCHEME}:` || isTrustedRendererOrigin(parsed.origin);
	} catch {
		return false;
	}
}

export function isTrustedAppRendererUrl(url?: string): boolean {
	if (!url) return false;
	const devOrigin = rendererDevOrigin();
	try {
		const parsed = new URL(url);
		if (devOrigin && parsed.origin === devOrigin) return true;
		if (parsed.protocol !== 'file:') return false;
		return (
			path.resolve(fileURLToPath(parsed)) ===
			path.resolve(app.getAppPath(), 'out/renderer/index.html')
		);
	} catch {
		return false;
	}
}

function isAppWindowWebContents(
	webContents: Electron.WebContents | null,
	appRegistry: AppRegistry
): boolean {
	return Boolean(
		webContents && (BrowserWindow.fromWebContents(webContents) || appRegistry.has(webContents))
	);
}

function isTrustedMediaRequestSource(
	requestingOrigin: string | undefined,
	requestingUrl: string | undefined,
	securityOrigin: string | undefined
): boolean {
	return (
		isTrustedRendererOrigin(requestingOrigin) ||
		isTrustedRendererOrigin(securityOrigin) ||
		isTrustedRendererUrl(requestingUrl)
	);
}

function showDisplayCaptureMessage(
	parentWindow: BrowserWindow | null,
	options: Electron.MessageBoxOptions
): void {
	void (
		parentWindow ? dialog.showMessageBox(parentWindow, options) : dialog.showMessageBox(options)
	).catch(() => undefined);
}
