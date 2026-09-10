import { Tray as ElectronTray, Menu, nativeImage } from 'electron';
import path from 'node:path';

import { loadTranslations } from './i18n';
import type { App } from './apps/app_index';
import { resourceRoot } from './shared/resource_root';

interface TrayManagerCallbacks {
	onToggleApp: () => void;
	onToggleVoiceConversation: () => void;
	onQuit: () => void;
	isAppVisible: () => boolean;
	hasVoiceConversation: () => boolean;
	isVoiceConversationVisible: () => boolean;
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

		this.tray.on('click', () => {
			this.callbacks.onToggleApp();
		});

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
		const voiceConversationVisible = this.callbacks.isVoiceConversationVisible();
		const hasVoiceConversation = this.callbacks.hasVoiceConversation();
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
				label: isVisible ? m.hideKucedr || 'Hide Kucedr' : m.showKucedr || 'Show Kucedr',
				click: () => this.callbacks.onToggleApp(),
			},
			{
				label: voiceConversationVisible
					? m.hideVoiceConversation || 'Hide Voice Conversation'
					: m.showVoiceConversation || 'Show Voice Conversation',
				enabled: hasVoiceConversation,
				click: () => this.callbacks.onToggleVoiceConversation(),
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
