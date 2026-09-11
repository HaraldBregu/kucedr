import { app, BrowserWindow, Menu as ElectronMenu } from 'electron';
import { loadTranslations } from './i18n';
import type { App } from './apps/app_index';

interface MenuManagerCallbacks {
	onLanguageChange: (lng: string) => void;
	onNewWindow: () => void;
	getApps: () => App[];
	onOpenApp: (app: App) => void;
	onOpenAppDataFolder?: () => void;
	onOpenDataFolder?: () => void;
	getTrayEnabled?: () => boolean;
	onTrayEnabledChange?: (enabled: boolean) => void;
	getKeepAwake?: () => boolean;
	onKeepAwakeChange?: (enabled: boolean) => void;
	getTheme?: () => 'light' | 'dark' | 'system';
	onThemeChange?: (theme: 'light' | 'dark' | 'system') => void;
}

export class Menu {
	private currentLanguage = 'en';
	private callbacks: MenuManagerCallbacks;
	constructor(callbacks: MenuManagerCallbacks) {
		this.callbacks = callbacks;
	}


	create(): void {
		this.buildMenu();
	}

	updateLanguage(lng: string): void {
		this.currentLanguage = lng;
		this.buildMenu();
	}

	private buildMenu(): void {
		const isMac = process.platform === 'darwin';
		const m = loadTranslations(this.currentLanguage, 'menu');

		const apps = this.callbacks.getApps();
		const appSubmenu =
			apps.length > 0
				? apps.map((app) => ({
						label: app.title,
						click: (): void => this.callbacks.onOpenApp(app),
					}))
				: [{ label: m.noApps || 'No apps', enabled: false }];

		const switchLanguage = (lng: string): void => {
			this.currentLanguage = lng;
			this.buildMenu();
			this.callbacks.onLanguageChange(lng);
		};
		const switchTray = (): void => {
			this.callbacks.onTrayEnabledChange?.(!(this.callbacks.getTrayEnabled?.() ?? true));
			this.buildMenu();
		};
		const switchKeepAwake = (): void => {
			this.callbacks.onKeepAwakeChange?.(!(this.callbacks.getKeepAwake?.() ?? false));
			this.buildMenu();
		};
		const switchTheme = (theme: 'light' | 'dark' | 'system'): void => {
			this.callbacks.onThemeChange?.(theme);
			this.buildMenu();
		};

		const template: Electron.MenuItemConstructorOptions[] = [
			...(isMac
				? [
						{
							label: app.name,
							submenu: [
								{ label: m.about, role: 'about' as const },
								{ type: 'separator' as const },
								{ label: m.services, role: 'services' as const },
								{ type: 'separator' as const },
								{ label: m.hide, role: 'hide' as const },
								{ label: m.hideOthers, role: 'hideOthers' as const },
								{ label: m.unhide, role: 'unhide' as const },
								{ type: 'separator' as const },
								{ label: m.quit, role: 'quit' as const },
							],
						},
					]
				: []),
			{
				label: m.file,
				submenu: [
					{
						label: m.newWindow,
						accelerator: 'CmdOrCtrl+Shift+N',
						click: (): void => {
							this.callbacks.onNewWindow();
						},
					},
					isMac
						? { label: m.close, role: 'close' as const }
						: { label: m.quit, role: 'quit' as const },
				],
			},
			{
				label: m.edit,
				submenu: [
					{ label: m.undo, role: 'undo' as const },
					{ label: m.redo, role: 'redo' as const },
					{ type: 'separator' as const },
					{ label: m.cut, role: 'cut' as const },
					{ label: m.copy, role: 'copy' as const },
					{ label: m.paste, role: 'paste' as const },
					{ label: m.selectAll, role: 'selectAll' as const },
				],
			},
			{
				label: m.view,
				submenu: [
					{ label: m.reload, role: 'reload' as const },
					{ label: m.forceReload, role: 'forceReload' as const },
				],
			},
			{
				label: m.settings,
				submenu: [
					{
						label: m.openAppData,
						click: (): void => this.callbacks.onOpenAppDataFolder?.(),
					},
					{
						label: m.openData,
						click: (): void => this.callbacks.onOpenDataFolder?.(),
					},
					{ type: 'separator' as const },
					{
						label: m.menuBar,
						type: 'checkbox' as const,
						checked: this.callbacks.getTrayEnabled?.() ?? true,
						click: switchTray,
					},
					{
						label: m.keepAwake,
						type: 'checkbox' as const,
						checked: this.callbacks.getKeepAwake?.() ?? false,
						click: switchKeepAwake,
					},
					{
						label: m.theme,
						submenu: [
							...(['system', 'light', 'dark'] as const).map((theme) => ({
								label: m[`${theme}Theme`],
								type: 'radio' as const,
								checked: (this.callbacks.getTheme?.() ?? 'system') === theme,
								click: (): void => switchTheme(theme),
							})),
						],
					},
					{
						label: m.language,
						submenu: [
							{
								label: 'English',
								type: 'radio' as const,
								checked: this.currentLanguage === 'en',
								click: (): void => switchLanguage('en'),
							},
							{
								label: 'Italiano',
								type: 'radio' as const,
								checked: this.currentLanguage === 'it',
								click: (): void => switchLanguage('it'),
							},
						],
					},
				],
			},
			{
				label: m.apps,
				submenu: appSubmenu,
			},
			{
				label: m.window,
				submenu: [
					{ label: m.minimize, role: 'minimize' as const },
					...(isMac
						? [{ type: 'separator' as const }, { label: m.front, role: 'front' as const }]
						: [{ label: m.close, role: 'close' as const }]),
				],
			},
			{
				label: m.developer,
				submenu: [
					{
						label: m.language,
						submenu: [
							{
								label: 'English',
								type: 'radio' as const,
								checked: this.currentLanguage === 'en',
								click: (): void => switchLanguage('en'),
							},
							{
								label: 'Italiano',
								type: 'radio' as const,
								checked: this.currentLanguage === 'it',
								click: (): void => switchLanguage('it'),
							},
						],
					},
					{ type: 'separator' as const },
					{
						label: m.showConsole,
						accelerator: 'CmdOrCtrl+Shift+I',
						click: (): void => {
							const win = BrowserWindow.getFocusedWindow();
							if (win) win.webContents.toggleDevTools();
						},
					},
					{
						label: m.refresh,
						accelerator: 'CmdOrCtrl+R',
						click: (): void => {
							const win = BrowserWindow.getFocusedWindow();
							if (win) win.webContents.reload();
						},
					},
				],
			},
		];

		const menu = ElectronMenu.buildFromTemplate(template);
		ElectronMenu.setApplicationMenu(menu);
	}
}
