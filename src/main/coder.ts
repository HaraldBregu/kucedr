import type { BrowserWindow } from 'electron';
import type { WindowFactory } from './window_factory';
import type { WindowContextManager } from './window_context';
import { attachWindowHandlers } from './window_events';

export class CoderWindow {
	private window: BrowserWindow | null = null;

	constructor(
		private readonly windowFactory: WindowFactory,
		private readonly windowContextManager: WindowContextManager
	) {}

	open(): void {
		if (this.window && !this.window.isDestroyed()) {
			this.window.restore();
			this.window.show();
			this.window.focus();
			return;
		}
		const win = this.windowFactory.create(
			{
				width: 1280,
				height: 800,
				minWidth: 900,
				minHeight: 600,
				title: 'Coder',
				show: false,
				frame: false,
				...(process.platform === 'darwin' && {
					titleBarStyle: 'hidden' as const,
					trafficLightPosition: { x: 16, y: 17 },
				}),
			},
			{ html: 'coder.html' }
		);
		this.window = win;
		this.windowContextManager.create(win);
		attachWindowHandlers(win);
		win.on('closed', () => {
			if (this.window === win) this.window = null;
		});
		win.once('ready-to-show', () => {
			win.show();
			win.focus();
		});
	}
}
