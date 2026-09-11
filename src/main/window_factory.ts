import {
	app,
	BrowserWindow,
	BrowserWindowConstructorOptions,
	shell,
	WebContentsView,
	type WebContents,
} from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { is } from '@electron-toolkit/utils';
import type { LoggerService } from './shared';
import { resourceRoot } from './shared/resource_root';
import { setupPdfContextMenu } from './pdf';
import type { AppRegistry } from './apps/app_registry';
import { externalUrl } from './external';
import {
	APP_RESOURCE_SCHEME,
	APP_SESSION_PARTITION,
	appResourceUrl,
} from './protocol';

export interface WindowPreset {
	name: string;
	options: Partial<BrowserWindowConstructorOptions>;
}

export interface RendererContentOptions {
	html?: string;
	hash?: string;
	file?: string;
}

export interface LoadableView {
	view: WebContentsView;
	load: () => Promise<void>;
}

export class WindowFactory {
	private readonly preloadPath: string;
	private readonly iconPath: string;

	constructor(
		private readonly logger: LoggerService | undefined,
		private readonly appRegistry: AppRegistry
	) {
		// Use path.resolve to ensure absolute path for preload
		// Output as .js (CommonJS) for Electron preload compatibility
		this.preloadPath = path.resolve(app.getAppPath(), 'out/preload/index.js');
		this.iconPath = path.resolve(resourceRoot(), 'resources/icons/icon.png');
		this.logger?.info('WindowFactory', `Preload path: ${this.preloadPath}`);
		this.logger?.info('WindowFactory', `Preload file exists: ${existsSync(this.preloadPath)}`);
	}

	private getBaseWebPreferences(): Electron.WebPreferences {
		return {
			preload: this.preloadPath,
			sandbox: true,
			nodeIntegration: false,
			contextIsolation: true,
			devTools: is.dev,
			webSecurity: true,
			allowRunningInsecureContent: false,
			spellcheck: false,
		};
	}

	private secureNavigation(
		webContents: WebContents,
		fileRoot?: string,
		appId?: string
	): void {
		webContents.setWindowOpenHandler(({ url }) => {
			if (fileRoot || appId) {
				const target = externalUrl(url);
				if (target) {
					void shell.openExternal(target).catch((error) => {
						this.logger?.warn('WindowFactory', 'Failed to open external URL', {
							url: target,
							error,
						});
					});
				}
			}
			return { action: 'deny' };
		});
		webContents.on('will-navigate', (event, url) => {
			const target = new URL(url);
			if (
				appId &&
				target.protocol === `${APP_RESOURCE_SCHEME}:` &&
				target.host === appId
			) {
				return;
			}
			if (target.protocol === 'file:') {
				if (!fileRoot) {
					event.preventDefault();
					return;
				}
				const relative = path.relative(fileRoot, fileURLToPath(target));
				if (relative.startsWith('..') || path.isAbsolute(relative)) event.preventDefault();
				return;
			}
			const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
			if (is.dev && rendererUrl && target.origin === new URL(rendererUrl).origin) return;
			event.preventDefault();
			const externalTarget = fileRoot || appId ? externalUrl(url) : null;
			if (externalTarget) {
				void shell.openExternal(externalTarget).catch((error) => {
					this.logger?.warn('WindowFactory', 'Failed to open external URL', {
						url: externalTarget,
						error,
					});
				});
			}
		});
	}

	/**
	 * Create a BrowserWindow with base security defaults merged with overrides.
	 */
	create(
		overrides: Partial<BrowserWindowConstructorOptions> = {},
		content: RendererContentOptions = {}
	): BrowserWindow {
		const options: BrowserWindowConstructorOptions = {
			width: 440,
			height: 600,
			minWidth: 440,
			minHeight: 600,
			show: false,
			icon: this.iconPath,
			...overrides,
			autoHideMenuBar: false,
			webPreferences: {
				...this.getBaseWebPreferences(),
				...overrides.webPreferences,
				sandbox: true,
				nodeIntegration: false,
				contextIsolation: true,
				webSecurity: true,
				allowRunningInsecureContent: false,
			},
		};

		const win = new BrowserWindow(options);
		win.setMenuBarVisibility(true);
		setupPdfContextMenu(win);

		this.secureNavigation(win.webContents, content.file ? path.dirname(content.file) : undefined);

		this.loadContent(win, content);
		return win;
	}

	createView(file: string, appId: string): LoadableView {
		const view = new WebContentsView({
			webPreferences: {
				...this.getBaseWebPreferences(),
				partition: APP_SESSION_PARTITION,
			},
		});
		const viewContents = view.webContents;
		const resourceUrl = appResourceUrl(file, appId);
		this.appRegistry.register(viewContents, appId);
		this.secureNavigation(viewContents, undefined, appId);
		viewContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
			this.logger?.error('Apps', `App view failed to load: ${validatedURL}`, {
				errorCode,
				errorDescription,
			});
		});
		viewContents.on('render-process-gone', (_event, details) => {
			this.logger?.error('Apps', `App renderer exited: ${file}`, {
				reason: details.reason,
				exitCode: details.exitCode,
			});
		});
		const load = async (): Promise<void> => {
			try {
				await viewContents.loadURL(resourceUrl);
			} catch (error) {
				this.logger?.error('Apps', `Unable to open app entry: ${file}`, {
					error: error instanceof Error ? error.message : String(error),
				});
				throw error;
			}
		};
		return { view, load };
	}

	/**
	 * Load the renderer content (dev URL or production file).
	 */
	loadContent(win: BrowserWindow, content: RendererContentOptions = {}): void {
		const { html = 'index.html', hash, file } = content;

		if (file) {
			win.loadFile(file);
			return;
		}

		if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
			const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
			const baseUrl = rendererUrl.endsWith('/') ? rendererUrl : `${rendererUrl}/`;
			const url = html === 'index.html' ? new URL(rendererUrl) : new URL(html, baseUrl);
			if (hash) {
				url.hash = `/${hash}`;
			}
			win.loadURL(url.toString());
		} else {
			const loadOptions = hash ? { hash } : undefined;
			win.loadFile(path.join(app.getAppPath(), 'out/renderer', html), loadOptions);
		}
	}
}
