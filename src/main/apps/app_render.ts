import type { BrowserWindow, WebContents, WebContentsView } from 'electron';
import { setupPdfContextMenu } from '../pdf';
import type { WindowFactory } from '../window_factory';
import { attachWindowHandlers } from '../window_events';
import { getPlatformTranslucencyOptions } from '../translucency';
import type { AppTitlebarOptions } from '../../shared/window_types';
import {
	APP_WINDOW_DEFAULTS,
	type ResolvedAppWindowSettings,
} from '../../shared/app_window_settings';

export interface AppWindow {
	window: BrowserWindow;
	ready: boolean;
	contents?: WebContents;
	titlebarOptions: AppTitlebarOptions | null;
}

const windows = new Map<string, AppWindow>();
export const openAppWindows: ReadonlyMap<string, AppWindow> = windows;
const titleBarHeight = 48;

export function render(
	windowFactory: WindowFactory,
	file: string,
	title: string,
	appId: string,
	settings: ResolvedAppWindowSettings = APP_WINDOW_DEFAULTS
): BrowserWindow {
	const existing = windows.get(appId);
	if (existing && !existing.window.isDestroyed()) {
		if (existing.window.isMinimized()) existing.window.restore();
		if (existing.ready && !existing.window.isVisible()) existing.window.show();
		existing.window.focus();
		return existing.window;
	}

	const isMac = process.platform === 'darwin';
	const win = windowFactory.create(
		{
			width: settings.width,
			height: settings.height,
			minWidth: settings.minWidth,
			minHeight: settings.minHeight,
			resizable: settings.resizable,
			maximizable: settings.maximizable,
			frame: false,
			transparent: true,
			...(isMac && {
				titleBarStyle: 'hidden',
				trafficLightPosition: { x: 16, y: 17 },
			}),
			...getPlatformTranslucencyOptions(),
			title,
			backgroundColor: '#00000000',
		},
		{ html: 'app.html', hash: `app/${encodeURIComponent(title)}` }
	);

	const appWindow: AppWindow = {
		window: win,
		ready: false,
		titlebarOptions: null,
	};
	windows.set(appId, appWindow);
	let shellFailed = false;
	let appView: WebContentsView | undefined;
	let appContents: WebContents | undefined;
	let shellReady = false;
	let appReady = false;
	let childClosing = false;
	let hostCloseAllowed = false;
	const showWhenReady = (): void => {
		if (!shellReady || !appReady || win.isDestroyed()) return;
		appWindow.ready = true;
		win.show();
	};
	const resizeView = (): void => {
		if (!appView || win.isDestroyed()) return;
		const { width, height } = win.getContentBounds();
		appView.setBounds({
			x: 0,
			y: titleBarHeight,
			width,
			height: Math.max(0, height - titleBarHeight),
		});
	};
	const discardFailedShell = (): void => {
		if (shellFailed) return;
		shellFailed = true;
		if (windows.get(appId) === appWindow) windows.delete(appId);
		if (!win.isDestroyed()) win.destroy();
	};

	win.once('ready-to-show', () => {
		shellReady = true;
		showWhenReady();
	});
	win.webContents.once('did-finish-load', () => {
		if (win.isDestroyed()) return;
		const { view, load } = windowFactory.createView(file, appId);
		appView = view;
		appContents = view.webContents;
		appWindow.contents = appContents;
		const viewContents = appContents;

		view.setVisible(false);
		win.contentView.addChildView(view);
		resizeView();
		setupPdfContextMenu(win, viewContents);
		attachWindowHandlers(win, [win.webContents, viewContents]);
		viewContents.on('will-prevent-unload', () => {
			childClosing = false;
		});
		viewContents.once('destroyed', () => {
			childClosing = false;
			if (!win.isDestroyed()) {
				hostCloseAllowed = true;
				win.close();
			}
		});
		viewContents.once('render-process-gone', () => {
			if (!win.isDestroyed()) {
				hostCloseAllowed = true;
				win.close();
			}
		});
		void load()
			.then(() => {
				if (win.isDestroyed() || viewContents.isDestroyed()) return;
				view.setVisible(true);
				appReady = true;
				showWhenReady();
			})
			.catch(() => {
				if (!win.isDestroyed()) {
					hostCloseAllowed = true;
					win.close();
				}
			});
	});
	win.webContents.once('render-process-gone', discardFailedShell);
	win.webContents.once('did-fail-load', (_event, errorCode) => {
		if (errorCode !== -3) discardFailedShell();
	});
	win.webContents.on('page-title-updated', (event) => event.preventDefault());
	win.setTitle(title);
	win.on('resize', resizeView);
	win.on('close', (event) => {
		if (!appContents || hostCloseAllowed || appContents.isDestroyed()) return;
		event.preventDefault();
		if (childClosing) return;
		childClosing = true;
		appContents.close({ waitForBeforeUnload: true });
	});
	win.on('closed', () => {
		if (windows.get(appId) === appWindow) windows.delete(appId);
		if (appContents && !appContents.isDestroyed()) appContents.close();
	});
	return win;
}
