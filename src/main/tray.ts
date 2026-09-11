import { Tray as ElectronTray, Menu, nativeImage } from 'electron';
import path from 'node:path';

import { loadTranslations } from './i18n';
import type { App } from './apps/app_index';
import { resourceRoot } from './shared/resource_root';
import type { TrayClickAction } from '../shared/app_types';

interface TrayManagerCallbacks {
	onToggleChat: () => void;
	onStartPersona: () => void;
	onHidePersona: () => void;
	onShowPersona: () => void;
	onQuit: () => void;
	isAppVisible: () => boolean;
	isPersonaActive: () => boolean;
	isPersonaVisible: () => boolean;
	getTrayClickAction: () => TrayClickAction;
	getApps: () => App[];
	onOpenApp: (app: App) => void;
	getMicrophoneInputs?: () => Promise<readonly MicrophoneInput[]>;
	getMicrophoneInputId?: () => string;
	onMicrophoneInputChange?: (inputId: string) => void;
}

export interface MicrophoneInput {
	readonly id: string;
	readonly label: string;
}

export class Tray {
	private tray: ElectronTray | null = null;
	private contextMenu: Menu | null = null;
	private currentLanguage = 'en';
	private callbacks: TrayManagerCallbacks;
	private microphoneInputs: readonly MicrophoneInput[] = [];

	constructor(callbacks: TrayManagerCallbacks) {
		this.callbacks = callbacks;
	}

	create(): void {
		const icon = nativeImage.createFromPath(
			path.join(resourceRoot(), 'resources/icons/png/32x32.png')
		);

		this.tray = new ElectronTray(icon.resize({ width: 16, height: 16 }));
		this.tray.setToolTip('Kucedr');

		this.tray.on('click', () => this.handleTrayIconClick());

		this.tray.on('right-click', () => {
			void this.refreshMicrophoneInputs().finally(() => {
				this.buildContextMenu();
				if (this.contextMenu) this.tray?.popUpContextMenu(this.contextMenu);
			});
		});

		this.buildContextMenu();
		void this.refreshMicrophoneInputs();
	}

	destroy(): void {
		if (this.tray) {
			this.tray.destroy();
			this.tray = null;
			this.contextMenu = null;
		}
	}

	isCreated(): boolean {
		return this.tray !== null;
	}

	updateLanguage(lng: string): void {
		this.currentLanguage = lng;
		this.buildContextMenu();
	}

	/**
	 * Rebuild the context menu (useful for updating dynamic labels)
	 */
	updateContextMenu(): void {
		this.buildContextMenu();
	}

	private handleTrayIconClick(): void {
		switch (this.callbacks.getTrayClickAction()) {
			case 'start-persona':
				this.callbacks.onStartPersona();
				return;
			case 'toggle-persona':
				if (!this.callbacks.isPersonaActive()) {
					this.callbacks.onStartPersona();
				} else if (this.callbacks.isPersonaVisible()) {
					this.callbacks.onHidePersona();
				} else {
					this.callbacks.onShowPersona();
				}
				return;
			default:
				this.callbacks.onToggleChat();
		}
	}

	private async refreshMicrophoneInputs(): Promise<void> {
		if (!this.callbacks.getMicrophoneInputs) return;
		try {
			this.microphoneInputs = await this.callbacks.getMicrophoneInputs();
		} catch {
			this.microphoneInputs = [];
		}
	}

	private buildContextMenu(): void {
		if (!this.tray) {
			this.contextMenu = null;
			return;
		}
		const m = loadTranslations(this.currentLanguage, 'tray');
		const isVisible = this.callbacks.isAppVisible();
		const personaActive = this.callbacks.isPersonaActive();
		const personaVisible = this.callbacks.isPersonaVisible();
		const apps = this.callbacks.getApps();
		const selectedMicrophoneId = this.callbacks.getMicrophoneInputId?.() ?? 'default';
		const microphoneItems: Electron.MenuItemConstructorOptions[] = [
			{
				label: m.microphoneDefault || 'System default',
				type: 'radio',
				checked: selectedMicrophoneId === 'default',
				click: (): void => {
					this.callbacks.onMicrophoneInputChange?.('default');
					this.buildContextMenu();
				},
			},
			...this.microphoneInputs.map((input) => ({
				label: input.label,
				type: 'radio' as const,
				checked: selectedMicrophoneId === input.id,
				click: (): void => {
					this.callbacks.onMicrophoneInputChange?.(input.id);
					this.buildContextMenu();
				},
			})),
		];
		const appItems: Array<Electron.MenuItemConstructorOptions> = apps.length
			? apps.map((app) => ({
					label: app.title,
					click: (): void => this.callbacks.onOpenApp(app),
				}))
			: [{ label: m.noApps || 'No apps', enabled: false }];

		this.contextMenu = Menu.buildFromTemplate([
			{
				label: isVisible ? m.hideChat || 'Hide Chat' : m.showChat || 'Show Chat',
				click: () => this.callbacks.onToggleChat(),
			},
			{
				label: !personaActive
					? m.startPersona || 'Start Persona'
					: personaVisible
						? m.hidePersona || 'Hide Persona'
						: m.showPersona || 'Show Persona',
				enabled: true,
				click: () =>
					!personaActive
						? this.callbacks.onStartPersona()
						: personaVisible
							? this.callbacks.onHidePersona()
							: this.callbacks.onShowPersona(),
			},
			{
				label: m.apps || 'Apps',
				submenu: appItems,
			},
			{
				label: m.microphone || 'Microphone',
				submenu: microphoneItems,
			},
			{ type: 'separator' },
			{
				label: m.quit,
				click: () => this.callbacks.onQuit(),
			},
		]);
	}
}
