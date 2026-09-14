import { app, type BrowserWindow } from 'electron';
import type { RendererContentOptions, WindowFactory } from './window_factory';
import type { WindowContextManager } from './window_context';
import { attachWindowHandlers } from './window_events';
import { getPlatformTranslucencyOptions } from './translucency';
import { randomUUID } from 'node:crypto';

const VOICE_WINDOW_WIDTH = 360;
const VOICE_WINDOW_HEIGHT = 480;
const TRANSPARENT_WINDOW_BACKGROUND = '#00000000';

export class VoiceWindow {
	private window: BrowserWindow | null = null;
	private chatSessionId: string | null = null;
	private onVisibilityChange?: () => void;

	constructor(
		private readonly windowFactory: WindowFactory,
		private readonly windowContextManager: WindowContextManager
	) {}

	private showWindow(win: BrowserWindow): void {
		if (process.platform === 'darwin') app.focus({ steal: true });
		win.restore();
		win.show();
		win.moveTop();
		win.focus();
	}

	private createWindowOptions() {
		const isMac = process.platform === 'darwin';
		return {
			width: VOICE_WINDOW_WIDTH,
			height: VOICE_WINDOW_HEIGHT,
			minWidth: VOICE_WINDOW_WIDTH,
			minHeight: VOICE_WINDOW_HEIGHT,
			maxWidth: VOICE_WINDOW_WIDTH,
			maxHeight: VOICE_WINDOW_HEIGHT,
			resizable: false,
			minimizable: false,
			maximizable: false,
			fullscreenable: false,
			frame: false,
			...(isMac && {
				titleBarStyle: 'hidden' as const,
				trafficLightPosition: { x: 16, y: 17 },
			}),
			transparent: true,
			backgroundColor: TRANSPARENT_WINDOW_BACKGROUND,
			...getPlatformTranslucencyOptions(),
			title: 'Voice conversation',
			center: true,
			alwaysOnTop: true,
			skipTaskbar: true,
			show: false,
		};
	}

	open(chatSessionId: string): void {
		const existing = this.window;
		if (existing && !existing.isDestroyed()) {
			this.show();
			return;
		}
		this.chatSessionId = chatSessionId;

		const content: RendererContentOptions = {
			html: 'voice.html',
			hash: `voice/${encodeURIComponent(chatSessionId)}`,
		};
		const win = this.windowFactory.create(this.createWindowOptions(), content);
		if (process.platform === 'darwin') win.setWindowButtonVisibility(false);
		this.window = win;
		win.setBackgroundColor(TRANSPARENT_WINDOW_BACKGROUND);
		this.windowContextManager.create(win);
		attachWindowHandlers(win);
		win.setAlwaysOnTop(true, 'floating');
		if (typeof win.setVisibleOnAllWorkspaces === 'function') {
			win.setVisibleOnAllWorkspaces(true, {
				visibleOnFullScreen: true,
				skipTransformProcessType: true,
			});
		}
		win.on('closed', () => {
			if (this.window?.id === win.id) this.window = null;
			this.onVisibilityChange?.();
		});
		win.on('show', () => this.onVisibilityChange?.());
		win.on('hide', () => this.onVisibilityChange?.());
		win.once('ready-to-show', () => {
			win.setBackgroundColor(TRANSPARENT_WINDOW_BACKGROUND);
			this.showWindow(win);
		});
	}

	start(): void {
		this.open(this.chatSessionId ?? randomUUID());
	}

	show(): void {
		const win = this.window;
		if (!win || win.isDestroyed()) return;
		this.showWindow(win);
	}

	hide(): void {
		const win = this.window;
		if (!win || win.isDestroyed()) return;
		win.hide();
	}

	end(): void {
		const win = this.window;
		if (!win || win.isDestroyed()) return;
		this.window = null;
		this.onVisibilityChange?.();
		win.close();
	}

	isActive(): boolean {
		return Boolean(this.window && !this.window.isDestroyed());
	}

	isVisible(): boolean {
		return Boolean(this.window && !this.window.isDestroyed() && this.window.isVisible());
	}

	setOnVisibilityChange(callback: () => void): void {
		this.onVisibilityChange = callback;
	}
}
