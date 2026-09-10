import type { BrowserWindow } from 'electron';
import type { AppState } from './app_state';
import type { RendererContentOptions, WindowFactory } from './window_factory';
import type { WindowContextManager } from './window_context';
import { attachWindowHandlers } from './window_events';
import { getPlatformTranslucencyOptions } from './translucency';

const DEFAULT_WINDOW_WIDTH = 812;
const DEFAULT_WINDOW_HEIGHT = 625;
const MINIMUM_WINDOW_WIDTH = 768;
const MINIMUM_WINDOW_HEIGHT = 600;
const STARTUP_WINDOW_WIDTH = 812;
const STARTUP_WINDOW_HEIGHT = 625;
const TRANSPARENT_WINDOW_BACKGROUND = '#00000000';

export class Main {
	private window: BrowserWindow | null = null;
	private readonly appWindows = new Set<BrowserWindow>();
	private onWindowVisibilityChange?: () => void;

	constructor(
		private appState: AppState,
		private windowFactory: WindowFactory,
		private windowContextManager: WindowContextManager
	) {
		// Constructor is now minimal
		// All services are managed by ServiceContainer in bootstrap
		// All IPC handlers are registered in IPC modules via bootstrap
	}

	private createWindowOptions(trafficLightPosition = { x: 16, y: 17 }) {
		const isMac = process.platform === 'darwin';
		return {
			width: DEFAULT_WINDOW_WIDTH,
			height: DEFAULT_WINDOW_HEIGHT,
			minWidth: MINIMUM_WINDOW_WIDTH,
			minHeight: MINIMUM_WINDOW_HEIGHT,
			resizable: true,
			maximizable: true,
			fullscreenable: false,
			frame: false,
			// titleBarStyle:'hidden' on Windows retains native min/max/close buttons.
			// Only use it on macOS where it hides the title bar while keeping traffic lights.
			...(isMac && {
				titleBarStyle: 'hidden' as const,
				trafficLightPosition,
			}),
			transparent: true,
			backgroundColor: TRANSPARENT_WINDOW_BACKGROUND,
			...getPlatformTranslucencyOptions(),
		};
	}

	private createStartupWindowOptions() {
		return {
			...this.createWindowOptions(),
			width: STARTUP_WINDOW_WIDTH,
			height: STARTUP_WINDOW_HEIGHT,
		};
	}

	private trackWindowVisibility(win: BrowserWindow): void {
		win.on('show', () => {
			this.onWindowVisibilityChange?.();
		});

		win.on('hide', () => {
			this.onWindowVisibilityChange?.();
		});

		win.on('closed', () => {
			this.appWindows.delete(win);
			if (this.window?.id === win.id) {
				this.window = null;
			}
			this.onWindowVisibilityChange?.();
		});
	}

	private createLauncherWindow(
		options: {
			closeToTray?: boolean;
			content?: RendererContentOptions;
			onReadyToShow?: (win: BrowserWindow) => void;
		} = {}
	): BrowserWindow {
		const { closeToTray = false, content, onReadyToShow } = options;
		const win = this.windowFactory.create(this.createStartupWindowOptions(), content);
		win.setBackgroundColor(TRANSPARENT_WINDOW_BACKGROUND);
		this.appWindows.add(win);

		// Create window context for isolated services
		this.windowContextManager.create(win);

		attachWindowHandlers(win);
		this.trackWindowVisibility(win);

		win.once('ready-to-show', () => {
			win.setBackgroundColor(TRANSPARENT_WINDOW_BACKGROUND);
			win.show();
			onReadyToShow?.(win);
		});

		if (closeToTray) {
			win.on('close', (event) => {
				if (this.appState.isQuitting) {
					return;
				}

				event.preventDefault();
				win.hide();
				this.onWindowVisibilityChange?.();
			});
			this.window = win;
		}

		return win;
	}

	private getPreferredWindow(): BrowserWindow | null {
		if (this.window && !this.window.isDestroyed()) {
			return this.window;
		}

		return this.getOpenAppWindows()[0] ?? null;
	}

	private getOpenAppWindows(): BrowserWindow[] {
		const windows: BrowserWindow[] = [];
		for (const win of this.appWindows) {
			if (win.isDestroyed()) {
				this.appWindows.delete(win);
				continue;
			}
			windows.push(win);
		}
		return windows;
	}

	create(): BrowserWindow {
		return this.createLauncherWindow({ closeToTray: true, content: { hash: 'start' } });
	}

	showOrCreate(): void {
		const preferredWindow = this.getPreferredWindow();
		if (!preferredWindow) {
			this.create();
			return;
		}

		preferredWindow.show();
		preferredWindow.focus();
	}

	hide(): void {
		this.getOpenAppWindows().forEach((win) => {
			win.hide();
		});
	}

	toggleVisibility(): void {
		if (!this.isVisible()) {
			this.showOrCreate();
			return;
		}

		const windows = this.getOpenAppWindows();
		if (windows.length === 0) {
			this.create();
			return;
		}

		windows.forEach((win) => {
			win.hide();
		});
	}

	isVisible(): boolean {
		return this.getOpenAppWindows().some((win) => win.isVisible());
	}

	setOnWindowVisibilityChange(callback: () => void): void {
		this.onWindowVisibilityChange = callback;
	}

	createAdditionalWindow(): BrowserWindow {
		return this.createLauncherWindow();
	}

	createWindowForFile(filePath: string): BrowserWindow {
		const win = this.windowFactory.create(this.createWindowOptions({ x: 9, y: 9 }));
		win.setBackgroundColor(TRANSPARENT_WINDOW_BACKGROUND);
		this.appWindows.add(win);

		this.windowContextManager.create(win);
		attachWindowHandlers(win);
		this.trackWindowVisibility(win);

		win.once('ready-to-show', () => {
			win.setBackgroundColor(TRANSPARENT_WINDOW_BACKGROUND);
			win.show();
			win.webContents.send('file-opened', filePath);
		});

		return win;
	}

	getWindow(): BrowserWindow | null {
		return this.window;
	}
}
