import {
	app,
	BrowserWindow,
	clipboard,
	dialog,
	ipcMain,
	Menu,
	nativeImage,
	nativeTheme,
	shell,
	systemPreferences,
	type IpcMainInvokeEvent,
} from 'electron';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { copyFile, cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { agentLocation } from '../shared/agent_location';
import { libraryLocation } from '../shared/library_location';
import { userDataLocation } from '../shared/user_data_location';
import type { IpcModule } from './core/module';
import type { EventBus } from '../event_bus';
import type {
	MicrophonePermissionSettings,
	MicrophoneSystemPermissionStatus,
	CameraPermissionSettings,
	CameraSystemPermissionStatus,
	SystemPreferencePaneId,
	AppLanguage,
	AppTheme,
	AppThemeData,
	AppThemeColors,
} from '../../shared/app_types';
import { wrapIpcHandler, wrapSimpleHandler } from './core/error_handler';
import { setKeepAwake as applyKeepAwake } from '../keep_awake';
import {
	getTrayEnabled as getStoredTrayEnabled,
	setTrayEnabled as setStoredTrayEnabled,
	getKeepAwake as getStoredKeepAwake,
	setKeepAwake as setStoredKeepAwake,
	getLanguage as getStoredLanguage,
	setLanguage as setStoredLanguage,
	getTheme as getStoredTheme,
	setTheme as setStoredTheme,
	getLaunchState as getStoredLaunchState,
} from '../settings_store';
import { AppChannels } from '../../shared/ipc_channels_definitions';
import {
	loadDatabases,
	loadMcps,
	loadModels,
	loadWebSearches,
	providersDir,
	refreshProviderCatalog,
	watchModels,
} from '../models';
import type { LoggerService } from '../shared';
import { validateProviderManifest } from '../../shared/providers/validation';
import type { ChannelStatusEvent, ChannelType } from '../../shared';
import {
	getChannelModelSelection,
	loadChannels,
	setChannelModelSelection,
	type ChannelRegistry,
} from '../channels';
import type { AppRegistry } from '../apps/app_registry';
import type { AppStorage } from '../apps/app_store';
import { registerAppStoreIpc } from './app_store';
import { externalUrl } from '../external';
import { unfurlUrl } from '../unfurl';
import type { ExecSandbox } from '../agent/sandbox';

export interface AppIpcDeps {
	logger: LoggerService;
	channelRegistry: ChannelRegistry;
	appRegistry: AppRegistry;
	appStorage: AppStorage;
	sandbox: ExecSandbox;
}

const SYSTEM_PREFERENCE_PANES: Record<SystemPreferencePaneId, string> = {
	Accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
	ScreenCapture: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
	Camera: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera',
	Microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
};

const lightThemeColors: AppThemeColors = {
	'radius': '0.625rem',
	'app-window-radius': '16px',
	'app-bg-opacity': '1',
	'app-surface-opacity': '1',
	'app-popover-opacity': '1',
	'app-sidebar-opacity': '1',
	'app-window-background-base': '#f3efe7',
	'app-surface-background-base': '#f8f5ef',
	'app-popover-background-base': '#f8f5ef',
	'app-sidebar-background-base': '#eae4d9',
	'app-window-border': '#19635f',
	'app-window-background':
		'color-mix(in srgb, var(--app-window-background-base) calc(var(--app-bg-opacity) * 100%), transparent)',
	'app-surface-background':
		'color-mix(in srgb, var(--app-surface-background-base) calc(var(--app-surface-opacity) * 100%), transparent)',
	'app-popover-background':
		'color-mix(in srgb, var(--app-popover-background-base) calc(var(--app-popover-opacity) * 100%), transparent)',
	'app-sidebar-background':
		'color-mix(in srgb, var(--app-sidebar-background-base) calc(var(--app-sidebar-opacity) * 100%), transparent)',
	'app-scrollbar-track': 'transparent',
	'app-scrollbar-thumb': 'color-mix(in srgb, var(--muted-foreground) 34%, transparent)',
	'app-scrollbar-thumb-hover': 'color-mix(in srgb, var(--muted-foreground) 52%, transparent)',
	'background': 'var(--app-window-background)',
	'foreground': '#302c26',
	'card': 'var(--app-surface-background)',
	'card-foreground': '#302c26',
	'popover': 'var(--app-popover-background)',
	'popover-foreground': '#302c26',
	'primary': '#302c26',
	'primary-foreground': '#f3efe7',
	'secondary': '#e8e1d5',
	'secondary-foreground': '#302c26',
	'muted': '#e8e1d5',
	'muted-foreground': '#655c51',
	'accent': '#e0d7c9',
	'accent-foreground': '#302c26',
	'destructive': 'oklch(0.577 0.245 27.325)',
	'destructive-foreground': 'oklch(0.97 0.01 17)',
	'border': 'color-mix(in srgb, #b3a797 45%, transparent)',
	'input': 'color-mix(in srgb, #b3a797 45%, transparent)',
	'ring': '#2b5fb1',
	'sidebar': 'var(--app-sidebar-background)',
	'sidebar-foreground': '#302c26',
	'sidebar-primary': '#302c26',
	'sidebar-primary-foreground': '#f3efe7',
	'sidebar-accent': '#e0d7c9',
	'sidebar-accent-foreground': '#302c26',
	'sidebar-border': 'color-mix(in srgb, #b3a797 45%, transparent)',
	'sidebar-ring': '#2b5fb1',
	'surface': 'var(--app-surface-background)',
	'surface-foreground': 'var(--foreground)',
	'code': 'var(--surface)',
	'code-foreground': 'var(--surface-foreground)',
	'code-highlight': '#e8e1d5',
	'code-number': '#655c51',
	'selection': '#302c26',
	'selection-foreground': '#f3efe7',
	'link': '#2b5fb1',
	'link-on-primary': 'oklch(0.78 0.12 254)',
	'command': 'oklch(0.45 0.18 300)',
};

const darkThemeColors: AppThemeColors = {
	...lightThemeColors,
	'app-window-background-base': 'oklch(0.145 0 0)',
	'app-surface-background-base': 'oklch(0.205 0 0)',
	'app-popover-background-base': 'oklch(0.205 0 0)',
	'app-sidebar-background-base': 'oklch(0.205 0 0)',
	'app-window-background':
		'color-mix(in oklch, var(--app-window-background-base) calc(var(--app-bg-opacity) * 100%), transparent)',
	'app-surface-background':
		'color-mix(in oklch, var(--app-surface-background-base) calc(var(--app-surface-opacity) * 100%), transparent)',
	'app-popover-background':
		'color-mix(in oklch, var(--app-popover-background-base) calc(var(--app-popover-opacity) * 100%), transparent)',
	'app-sidebar-background':
		'color-mix(in oklch, var(--app-sidebar-background-base) calc(var(--app-sidebar-opacity) * 100%), transparent)',
	'app-window-border': 'var(--border)',
	'app-scrollbar-track': 'oklch(1 0 0 / 6%)',
	'app-scrollbar-thumb': 'color-mix(in oklch, var(--foreground) 24%, transparent)',
	'app-scrollbar-thumb-hover': 'color-mix(in oklch, var(--foreground) 38%, transparent)',
	'foreground': 'oklch(0.985 0 0)',
	'card-foreground': 'oklch(0.985 0 0)',
	'popover-foreground': 'oklch(0.985 0 0)',
	'primary': 'oklch(0.922 0 0)',
	'primary-foreground': 'oklch(0.205 0 0)',
	'secondary': 'oklch(0.269 0 0)',
	'secondary-foreground': 'oklch(0.985 0 0)',
	'muted': 'oklch(0.269 0 0)',
	'muted-foreground': 'oklch(0.708 0 0)',
	'accent': 'oklch(0.371 0 0)',
	'accent-foreground': 'oklch(0.985 0 0)',
	'destructive': 'oklch(0.704 0.191 22.216)',
	'destructive-foreground': 'oklch(0.58 0.22 27)',
	'border': 'oklch(1 0 0 / 10%)',
	'input': 'oklch(1 0 0 / 15%)',
	'ring': 'oklch(0.556 0 0)',
	'sidebar-foreground': 'oklch(0.985 0 0)',
	'sidebar-primary': 'oklch(0.488 0.243 264.376)',
	'sidebar-primary-foreground': 'oklch(0.985 0 0)',
	'sidebar-accent': 'oklch(0.269 0 0)',
	'sidebar-accent-foreground': 'oklch(0.985 0 0)',
	'sidebar-border': 'oklch(1 0 0 / 10%)',
	'sidebar-ring': 'oklch(0.439 0 0)',
	'surface-foreground': 'oklch(0.708 0 0)',
	'code-highlight': 'oklch(0.27 0 0)',
	'code-number': 'oklch(0.72 0 0)',
	'selection': 'oklch(0.922 0 0)',
	'selection-foreground': 'oklch(0.205 0 0)',
	'link': 'oklch(0.68 0.15 254)',
	'link-on-primary': 'oklch(0.45 0.18 254)',
	'command': 'oklch(0.68 0.15 300)',
};

function getThemeData(): AppThemeData {
	const isDark = nativeTheme.shouldUseDarkColors;
	return {
		themeMode: getStoredTheme(),
		isDark,
		colors: isDark ? darkThemeColors : lightThemeColors,
	};
}

function getMicrophoneSystemStatus(): MicrophoneSystemPermissionStatus {
	if (process.platform !== 'darwin') return 'unknown';

	try {
		return systemPreferences.getMediaAccessStatus('microphone');
	} catch {
		return 'unknown';
	}
}

function canRequestMicrophoneAccess(status: MicrophoneSystemPermissionStatus): boolean {
	return process.platform === 'darwin' && status === 'not-determined';
}

function microphoneSettings(): MicrophonePermissionSettings {
	const systemStatus = getMicrophoneSystemStatus();
	return {
		enabled: true,
		systemStatus,
		canRequest: canRequestMicrophoneAccess(systemStatus),
	};
}

function getCameraSystemStatus(): CameraSystemPermissionStatus {
	if (process.platform !== 'darwin') return 'unknown';
	try {
		return systemPreferences.getMediaAccessStatus('camera');
	} catch {
		return 'unknown';
	}
}

function canRequestCameraAccess(status: CameraSystemPermissionStatus): boolean {
	return process.platform === 'darwin' && status === 'not-determined';
}

function cameraSettings(): CameraPermissionSettings {
	const systemStatus = getCameraSystemStatus();
	return {
		enabled: true,
		systemStatus,
		canRequest: canRequestCameraAccess(systemStatus),
	};
}

function readProviderFile(dir: string, file: string): unknown {
	const filePath = path.join(dir, file);
	if (!existsSync(filePath)) return undefined;
	try {
		return JSON.parse(readFileSync(filePath, 'utf-8'));
	} catch {
		throw new Error(`Invalid provider format: ${file} is not valid JSON.`);
	}
}

async function uploadProvider(
	event: IpcMainInvokeEvent,
	onCatalogChange: () => void
): Promise<string | null> {
	const window = BrowserWindow.fromWebContents(event.sender);
	const options: Electron.OpenDialogOptions = { properties: ['openDirectory'] };
	const result = window
		? await dialog.showOpenDialog(window, options)
		: await dialog.showOpenDialog(options);
	const source = result.filePaths[0];
	if (result.canceled || !source) return null;

	const manifest = readProviderFile(source, 'manifest.json');
	if (manifest === undefined) {
		throw new Error('Selected folder is not a provider (missing manifest.json).');
	}
	const errors = validateProviderManifest(manifest);
	if (errors.length > 0) {
		throw new Error(`Invalid provider format: ${errors.join(' ')}`);
	}

	const name = path.basename(source);
	await mkdir(providersDir(), { recursive: true });
	await cp(source, path.join(providersDir(), name), { recursive: true });
	onCatalogChange();
	return name;
}

async function openPathOrThrow(target: string): Promise<void> {
	const error = await shell.openPath(target);
	if (error) {
		throw new Error(error);
	}
}

async function saveImageAs(imagePath: string, window: BrowserWindow | null): Promise<void> {
	const options = { defaultPath: path.basename(imagePath) };
	const result = window
		? await dialog.showSaveDialog(window, options)
		: await dialog.showSaveDialog(options);
	if (result.canceled || !result.filePath) return;
	await copyFile(imagePath, result.filePath);
}

function validatedAgentImagePath(requestedPath: string): string {
	const roots = [agentLocation(), libraryLocation()];
	for (const root of roots) {
		try {
			const realRoot = realpathSync(path.resolve(root));
			const real = realpathSync(path.resolve(root, requestedPath));
			if (real.startsWith(realRoot + path.sep)) return real;
		} catch {
			// Root or file missing under this root; try the next one.
		}
	}
	throw new Error('Image path must be inside the agent or library data directory.');
}

function showImageContextMenu(event: IpcMainInvokeEvent, requestedPath: string): void {
	const imagePath = validatedAgentImagePath(requestedPath);
	const window = BrowserWindow.fromWebContents(event.sender);
	const menu = Menu.buildFromTemplate([
		{ label: 'Open', click: () => void shell.openPath(imagePath) },
		{ label: 'Open File Location', click: () => shell.showItemInFolder(imagePath) },
		{ type: 'separator' },
		{
			label: 'Copy Image',
			click: () => clipboard.writeImage(nativeImage.createFromPath(imagePath)),
		},
		{ label: 'Copy Path', click: () => clipboard.writeText(imagePath) },
		{ type: 'separator' },
		{ label: 'Save As…', click: () => void saveImageAs(imagePath, window) },
	]);
	menu.popup(window ? { window } : {});
}

function validatedAudioPath(requestedPath: string): string {
	const roots = [agentLocation(), libraryLocation(), path.resolve(userDataLocation(), 'sound')];
	for (const root of roots) {
		try {
			const realRoot = realpathSync(path.resolve(root));
			const real = realpathSync(path.resolve(root, requestedPath));
			if (real.startsWith(realRoot + path.sep)) return real;
		} catch {
			// Root or file missing under this root; try the next one.
		}
	}
	throw new Error('Audio path must be inside the agent or sound data directory.');
}

function showAudioContextMenu(event: IpcMainInvokeEvent, requestedPath: string): void {
	const audioPath = validatedAudioPath(requestedPath);
	const window = BrowserWindow.fromWebContents(event.sender);
	const menu = Menu.buildFromTemplate([
		{ label: 'Open', click: () => void shell.openPath(audioPath) },
		{ label: 'Open File Location', click: () => shell.showItemInFolder(audioPath) },
		{ type: 'separator' },
		{ label: 'Copy Path', click: () => clipboard.writeText(audioPath) },
		{ type: 'separator' },
		{ label: 'Save As…', click: () => void saveImageAs(audioPath, window) },
	]);
	menu.popup(window ? { window } : {});
}

function validatedVideoPath(requestedPath: string): string {
	const roots = [agentLocation(), libraryLocation(), path.resolve(userDataLocation(), 'video')];
	for (const root of roots) {
		try {
			const realRoot = realpathSync(path.resolve(root));
			const real = realpathSync(path.resolve(root, requestedPath));
			if (real.startsWith(realRoot + path.sep)) return real;
		} catch {
			// Root or file missing under this root; try the next one.
		}
	}
	throw new Error('Video path must be inside the agent or video data directory.');
}

function showVideoContextMenu(event: IpcMainInvokeEvent, requestedPath: string): void {
	const videoPath = validatedVideoPath(requestedPath);
	const window = BrowserWindow.fromWebContents(event.sender);
	const menu = Menu.buildFromTemplate([
		{ label: 'Open', click: () => void shell.openPath(videoPath) },
		{ label: 'Open File Location', click: () => shell.showItemInFolder(videoPath) },
		{ type: 'separator' },
		{ label: 'Copy Path', click: () => clipboard.writeText(videoPath) },
		{ type: 'separator' },
		{ label: 'Save As…', click: () => void saveImageAs(videoPath, window) },
	]);
	menu.popup(window ? { window } : {});
}

export class AppIpc implements IpcModule {
	readonly name = 'app';

	register(
		{ logger, channelRegistry, appRegistry, appStorage, sandbox }: AppIpcDeps,
		eventBus: EventBus
	): void {
		registerAppStoreIpc({ appRegistry, appStorage });
		let currentThemeData: AppThemeData = getThemeData();
		const emitThemeChangeEvent = (): void => {
			const nextThemeData: AppThemeData = getThemeData();
			if (
				nextThemeData.themeMode === currentThemeData.themeMode &&
				nextThemeData.isDark === currentThemeData.isDark
			) {
				return;
			}
			currentThemeData = nextThemeData;
			eventBus.broadcast(AppChannels.themeModeChanged, nextThemeData);
		};
		nativeTheme.on('updated', emitThemeChangeEvent);

		// Open application data folder in system file explorer
		ipcMain.handle(
			AppChannels.openAppDataFolder,
			wrapSimpleHandler(async () => {
				await openPathOrThrow(app.getPath('userData'));
			}, AppChannels.openAppDataFolder)
		);

		ipcMain.handle(
			AppChannels.openDataFolder,
			wrapSimpleHandler(async () => {
				await mkdir(userDataLocation(), { recursive: true });
				await openPathOrThrow(userDataLocation());
			}, AppChannels.openDataFolder)
		);

		ipcMain.handle(
			AppChannels.openProvidersFolder,
			wrapSimpleHandler(async () => {
				await openPathOrThrow(providersDir());
			}, AppChannels.openProvidersFolder)
		);

		ipcMain.handle(
			AppChannels.models,
			wrapSimpleHandler(() => {
				return [...loadModels()];
			}, AppChannels.models)
		);

		ipcMain.handle(
			AppChannels.databases,
			wrapSimpleHandler(() => {
				return [...loadDatabases()];
			}, AppChannels.databases)
		);

		ipcMain.handle(
			AppChannels.webSearches,
			wrapSimpleHandler(() => {
				return [...loadWebSearches()];
			}, AppChannels.webSearches)
		);

		ipcMain.handle(
			AppChannels.mcps,
			wrapSimpleHandler(() => {
				return [...loadMcps()];
			}, AppChannels.mcps)
		);

		ipcMain.handle(
			AppChannels.channels,
			wrapSimpleHandler(() => {
				return [...loadChannels()];
			}, AppChannels.channels)
		);

		ipcMain.handle(
			AppChannels.getChannelModelSelection,
			wrapSimpleHandler((kind: 'llm' | 'stt' | 'tts') => {
				return getChannelModelSelection(kind);
			}, AppChannels.getChannelModelSelection)
		);

		ipcMain.handle(
			AppChannels.setChannelModelSelection,
			wrapSimpleHandler((kind: 'llm' | 'stt' | 'tts', providerId: string, modelId: string) => {
				setChannelModelSelection(kind, {
					providerId: providerId?.trim(),
					modelId: modelId?.trim(),
				});
			}, AppChannels.setChannelModelSelection)
		);

		// Re-read the catalog and tell renderers when resources/providers changes on disk
		watchModels(() => eventBus.broadcast(AppChannels.modelsChanged));

		ipcMain.handle(
			AppChannels.openExternalUrl,
			wrapSimpleHandler(async (url: string) => {
				const target = externalUrl(url);
				if (!target) throw new Error('Invalid external URL.');
				await shell.openExternal(target);
			}, AppChannels.openExternalUrl)
		);

		ipcMain.handle(
			AppChannels.unfurlUrl,
			wrapSimpleHandler((url: string) => unfurlUrl(url), AppChannels.unfurlUrl)
		);

		ipcMain.handle(
			AppChannels.setTrayEnabled,
			wrapSimpleHandler((enabled: boolean) => {
				setStoredTrayEnabled(enabled);
				eventBus.emit('tray:set-enabled', { enabled });
				eventBus.broadcast(AppChannels.trayEnabledChanged, enabled);
			}, AppChannels.setTrayEnabled)
		);

		ipcMain.handle(
			AppChannels.getTrayEnabled,
			wrapSimpleHandler(() => {
				return getStoredTrayEnabled();
			}, AppChannels.getTrayEnabled)
		);

		ipcMain.handle(
			AppChannels.getLaunchState,
			wrapSimpleHandler(() => {
				return getStoredLaunchState();
			}, AppChannels.getLaunchState)
		);

		ipcMain.handle(
			AppChannels.setKeepAwake,
			wrapSimpleHandler((enabled: boolean) => {
				applyKeepAwake(enabled);
				setStoredKeepAwake(enabled);
				eventBus.broadcast(AppChannels.keepAwakeChanged, enabled);
			}, AppChannels.setKeepAwake)
		);

		ipcMain.handle(
			AppChannels.getKeepAwake,
			wrapSimpleHandler(() => {
				return getStoredKeepAwake();
			}, AppChannels.getKeepAwake)
		);

		ipcMain.handle(
			AppChannels.setLanguage,
			wrapSimpleHandler((language: AppLanguage) => {
				setStoredLanguage(language);
				eventBus.emit('language:changed', { language });
			}, AppChannels.setLanguage)
		);

		ipcMain.handle(
			AppChannels.getLanguage,
			wrapSimpleHandler(() => {
				return getStoredLanguage();
			}, AppChannels.getLanguage)
		);

		ipcMain.handle(
			AppChannels.setTheme,
			wrapSimpleHandler((theme: AppTheme) => {
				setStoredTheme(theme);
				nativeTheme.themeSource = theme;
				emitThemeChangeEvent();
			}, AppChannels.setTheme)
		);

		ipcMain.handle(
			AppChannels.getTheme,
			wrapSimpleHandler(() => {
				return getStoredTheme();
			}, AppChannels.getTheme)
		);

		ipcMain.handle(
			AppChannels.getThemeData,
			wrapSimpleHandler((): AppThemeData => {
				return getThemeData();
			}, AppChannels.getThemeData)
		);

		ipcMain.handle(
			AppChannels.getSandboxStatus,
			wrapSimpleHandler(() => sandbox.status(), AppChannels.getSandboxStatus)
		);

		ipcMain.handle(
			AppChannels.setupSandbox,
			wrapSimpleHandler(() => sandbox.setup(), AppChannels.setupSandbox)
		);

		ipcMain.handle(
			AppChannels.getMicrophonePermission,
			wrapSimpleHandler(() => {
				return microphoneSettings();
			}, AppChannels.getMicrophonePermission)
		);

		ipcMain.handle(
			AppChannels.setMicrophoneEnabled,
			wrapSimpleHandler((_enabled: boolean) => {
				return microphoneSettings();
			}, AppChannels.setMicrophoneEnabled)
		);

		ipcMain.handle(
			AppChannels.requestMicrophonePermission,
			wrapSimpleHandler(async () => {
				if (process.platform === 'darwin') {
					await systemPreferences.askForMediaAccess('microphone');
				}
				return microphoneSettings();
			}, AppChannels.requestMicrophonePermission)
		);

		ipcMain.handle(
			AppChannels.openSystemPreference,
			wrapSimpleHandler(async (pane: SystemPreferencePaneId) => {
				const url = SYSTEM_PREFERENCE_PANES[pane];
				if (!url) {
					throw new Error(`Unknown system preference pane: ${pane}`);
				}
				await shell.openExternal(url);
			}, AppChannels.openSystemPreference)
		);

		ipcMain.handle(
			AppChannels.getCameraPermission,
			wrapSimpleHandler(() => {
				return cameraSettings();
			}, AppChannels.getCameraPermission)
		);

		ipcMain.handle(
			AppChannels.setCameraEnabled,
			wrapSimpleHandler((_enabled: boolean) => {
				return cameraSettings();
			}, AppChannels.setCameraEnabled)
		);

		ipcMain.handle(
			AppChannels.openVideo,
			wrapSimpleHandler(async (videoPath: string) => {
				await openPathOrThrow(validatedVideoPath(videoPath));
			}, AppChannels.openVideo)
		);

		ipcMain.handle(
			AppChannels.showImageContextMenu,
			wrapIpcHandler((event, imagePath: string) => {
				showImageContextMenu(event, imagePath);
			}, AppChannels.showImageContextMenu)
		);

		ipcMain.handle(
			AppChannels.showVideoContextMenu,
			wrapIpcHandler((event, videoPath: string) => {
				showVideoContextMenu(event, videoPath);
			}, AppChannels.showVideoContextMenu)
		);

		ipcMain.handle(
			AppChannels.showAudioContextMenu,
			wrapIpcHandler((event, audioPath: string) => {
				showAudioContextMenu(event, audioPath);
			}, AppChannels.showAudioContextMenu)
		);

		ipcMain.handle(
			AppChannels.uploadProvider,
			wrapIpcHandler((event) => {
				return uploadProvider(event, () => {
					refreshProviderCatalog();
					eventBus.broadcast(AppChannels.modelsChanged);
				});
			}, AppChannels.uploadProvider)
		);

		ipcMain.handle(
			AppChannels.getChannelsStatus,
			wrapSimpleHandler((type?: ChannelType): ChannelStatusEvent | undefined => {
				return channelRegistry.getStatus(type);
			}, AppChannels.getChannelsStatus)
		);

		ipcMain.handle(
			AppChannels.startTelegram,
			wrapSimpleHandler(async (): Promise<ChannelStatusEvent | undefined> => {
				await channelRegistry.start('telegram');
				return channelRegistry.getStatus('telegram');
			}, AppChannels.startTelegram)
		);

		ipcMain.handle(
			AppChannels.stopTelegram,
			wrapSimpleHandler(async (): Promise<void> => {
				await channelRegistry.stop('telegram');
			}, AppChannels.stopTelegram)
		);

		ipcMain.handle(
			AppChannels.restartTelegram,
			wrapSimpleHandler(async (): Promise<ChannelStatusEvent | undefined> => {
				await channelRegistry.restart('telegram');
				return channelRegistry.getStatus('telegram');
			}, AppChannels.restartTelegram)
		);

		ipcMain.handle(
			AppChannels.requestCameraPermission,
			wrapSimpleHandler(async () => {
				if (process.platform === 'darwin') {
					await systemPreferences.askForMediaAccess('camera');
				}
				return cameraSettings();
			}, AppChannels.requestCameraPermission)
		);

		logger.info('AppIpc', `Registered ${this.name} module`);
	}
}
