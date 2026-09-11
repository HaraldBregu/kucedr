import {
	ipcMain,
	BrowserWindow,
	Menu as ElectronMenu,
	type MenuItemConstructorOptions,
	type WebContents,
} from 'electron';
import type { IpcModule } from './core/module';
import type { EventBus } from '../event_bus';
import { wrapIpcHandler } from './core/error_handler';
import { WindowChannels } from '../../shared/ipc_channels_definitions';
import type { LoggerService } from '../shared';
import type { ContextMenuDescriptor, ContextMenuRole } from '../../shared/window_types';
import type { AppRegistry } from '../apps/app_registry';
import { openAppWindows } from '../apps/app_render';

const contextMenuRoles = new Set<ContextMenuRole>([
	'undo',
	'redo',
	'cut',
	'copy',
	'paste',
	'pasteAndMatchStyle',
	'delete',
	'selectAll',
]);
const maxContextMenuItems = 50;
const maxContextMenuTextLength = 120;

export interface WindowIpcDeps {
	logger: LoggerService;
	appRegistry: AppRegistry;
	openVoiceConversation?: (chatSessionId: string) => void;
}

/**
 * IPC handlers for window management operations.
 *
 * Channels (send/on):
 *  - window:minimize   (send) -- Minimize the window
 *  - window:maximize   (send) -- Toggle maximize state
 *  - window:close      (send) -- Close the window
 *  - window:popup-menu (send) -- Show application menu as popup (Windows/Linux)
 *
 * Channels (invoke/handle):
 *  - window:is-maximized  (query) -- Check if window is maximized
 *  - window:is-fullscreen (query) -- Check if window is in fullscreen
 *  - window:context-menu:show (command) -- Show a native context menu
 * Event channels (push):
 *  - window:maximize-change  -- Window maximize state changed
 *  - window:fullscreen-change -- Window fullscreen state changed
 */
export class WindowIpc implements IpcModule<WindowIpcDeps> {
	readonly name = 'window';

	register(
		{ logger, appRegistry, openVoiceConversation }: WindowIpcDeps,
		_eventBus: EventBus
	): void {
		const getWindow = (sender: WebContents): BrowserWindow | null => {
			const window = BrowserWindow.fromWebContents(sender);
			if (window) return window;
			try {
				return openAppWindows.get(appRegistry.resolve(sender))?.window ?? null;
			} catch {
				return null;
			}
		};

		// --- Send handlers (fire-and-forget) ---

		ipcMain.on(WindowChannels.minimize, (event) => {
			const win = getWindow(event.sender);
			if (win) win.minimize();
		});

		ipcMain.on(WindowChannels.maximize, (event) => {
			const win = getWindow(event.sender);
			if (win) {
				if (!win.isMaximizable()) return;
				if (win.isMaximized()) {
					win.unmaximize();
				} else {
					win.maximize();
				}
			}
		});

		ipcMain.on(WindowChannels.close, (event) => {
			const win = getWindow(event.sender);
			if (win) win.close();
		});

		ipcMain.handle(
			WindowChannels.openVoiceConversation,
			wrapIpcHandler((_event, chatSessionId: string) => {
				if (typeof chatSessionId !== 'string' || !chatSessionId.trim()) {
					throw new Error('Invalid voice conversation session id.');
				}
				if (!openVoiceConversation) throw new Error('Voice conversations are unavailable.');
				openVoiceConversation(chatSessionId.trim());
			}, 'window:open-voice-conversation')
		);

		ipcMain.on(WindowChannels.popupMenu, (event) => {
			const win = getWindow(event.sender);
			if (win) {
				const menu = ElectronMenu.getApplicationMenu();
				if (menu) {
					menu.popup({ window: win });
				}
			}
		});

		// --- Query handlers (invoke/handle) ---

		ipcMain.handle(
			WindowChannels.isMaximized,
			wrapIpcHandler((event) => {
				const win = getWindow(event.sender);
				return win ? win.isMaximized() : false;
			}, 'window:is-maximized')
		);

		ipcMain.handle(
			WindowChannels.isFullScreen,
			wrapIpcHandler((event) => {
				const win = getWindow(event.sender);
				return win ? win.isFullScreen() : false;
			}, 'window:is-fullscreen')
		);

		ipcMain.handle(
			WindowChannels.showContextMenu,
			wrapIpcHandler((event, items: ContextMenuDescriptor[]) => {
				const win = getWindow(event.sender);
				if (!win) return null;
				if (!Array.isArray(items) || items.length === 0) {
					throw new Error('Context menu requires at least one item.');
				}
				if (items.length > maxContextMenuItems) {
					throw new Error(`Context menu supports at most ${maxContextMenuItems} items.`);
				}

				return new Promise<string | null>((resolve) => {
					let selectedId: string | null = null;
					const template: MenuItemConstructorOptions[] = items.map((item) => {
						if (typeof item !== 'object' || item === null) {
							throw new Error('Context menu items must be objects.');
						}
						if (item.type === 'separator') return { type: 'separator' };
						if (item.type === 'role') {
							if (!contextMenuRoles.has(item.role)) {
								throw new Error(`Unsupported context menu role: ${item.role}`);
							}
							if (
								item.label !== undefined &&
								(typeof item.label !== 'string' ||
									!item.label.trim() ||
									item.label.length > maxContextMenuTextLength)
							) {
								throw new Error('Context menu role labels must be non-empty strings.');
							}
							if (item.enabled !== undefined && typeof item.enabled !== 'boolean') {
								throw new Error('Context menu enabled values must be boolean.');
							}
							return {
								role: item.role,
								label: item.label,
								...(item.enabled === undefined ? {} : { enabled: item.enabled }),
							};
						}
						if (
							item.type !== undefined &&
							item.type !== 'item'
						) {
							throw new Error(`Unsupported context menu item type: ${item.type}`);
						}
						if (
							typeof item.id !== 'string' ||
							typeof item.label !== 'string' ||
							!item.id.trim() ||
							!item.label.trim() ||
							item.id.length > maxContextMenuTextLength ||
							item.label.length > maxContextMenuTextLength
						) {
							throw new Error('Context menu items require an id and label.');
						}
						if (
							item.accelerator !== undefined &&
							(typeof item.accelerator !== 'string' ||
								!item.accelerator.trim() ||
								item.accelerator.length > maxContextMenuTextLength)
						) {
							throw new Error('Context menu accelerators must be non-empty strings.');
						}
						if (item.enabled !== undefined && typeof item.enabled !== 'boolean') {
							throw new Error('Context menu enabled values must be boolean.');
						}
						return {
							id: item.id,
							label: item.label,
							accelerator: item.accelerator,
							enabled: item.enabled ?? true,
							click: () => {
								selectedId = item.id;
							},
						};
					});

					const menu = ElectronMenu.buildFromTemplate(template);
					menu.once('menu-will-close', () => {
						setImmediate(() => resolve(selectedId));
					});
					menu.popup({ window: win });
				});
			}, WindowChannels.showContextMenu)
		);

		logger.info('WindowIpc', `Registered ${this.name} module`);
	}
}
