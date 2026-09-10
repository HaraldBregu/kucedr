import { app, BrowserWindow, crashReporter, nativeTheme, shell } from 'electron';
import { mkdirSync } from 'node:fs';
import { Main } from './create_window';
import { Tray } from './tray';
import { setTrayEnabled } from './set_tray_enabled';
import {
	getTrayEnabled,
	setTrayEnabled as setStoredTrayEnabled,
	getKeepAwake,
	setKeepAwake as setStoredKeepAwake,
	getLanguage,
	setLanguage as setStoredLanguage,
	getTheme,
	setTheme as setStoredTheme,
	getMicrophoneInputId,
	setMicrophoneInputId,
	recordAppLaunch,
} from './settings_store';
import type { AppLanguage } from '../shared/app_types';
import { Menu } from './menu';
import { setKeepAwake } from './keep_awake';
import { userDataLocation } from './shared/user_data_location';
import { destroyAllApps, ensureApps, listApps, loadApp, watchApps } from './apps/app_index';
import { ShortcutManager } from './shortcuts';
import { setupAppLifecycle } from './lifecycle';
import {
	registerLocalResourceProtocolHandler,
	registerLocalResourceProtocolScheme,
	setupMediaPermissionHandlers,
} from './protocol';
import { registerIpcHandlers } from './ipc/core/register_ipc_handlers';
import { setupEventLogging, setupProcessSafetyNet } from './shared/error_reporter';
import { setupMemoryMonitor } from './shared/metrics';
import { bootstrapServices, cleanup } from './bootstrap';
import { startStorageSync, stopStorageSync } from './storage';
import { startRagSchedule, stopRagSchedule } from './agent/knowledge/rag';
import { CHANNEL_PROVIDER_IDS } from '../shared';
import { AppChannels } from '../shared/ipc_channels_definitions';
import { startWiki, stopWiki } from './agent/knowledge/wiki';
import { authLinks } from './cloud/links';
import { loadLocalEnvironment } from './cloud/environment';

// // DIAG: bump V8 old-space heap to confirm whether crashes (Chromium OOM,
// // exception 0xE0000008) come from the V8/JS heap or from native/C++
// // allocations. Must run before V8 isolates fully initialize. If crashes
// // take noticeably longer with this set, the leak is JS-side.
// app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192');
// if (process.platform === 'linux') {
// 	app.commandLine.appendSwitch('enable-transparent-visuals');
// }

loadLocalEnvironment(app.getAppPath(), app.isPackaged);
registerLocalResourceProtocolScheme();

// Install process-level safety net BEFORE anything else so we can see silent exits.
setupProcessSafetyNet();

// Start Chromium crash capture as early as possible so renderer/process
// crashes produce dumps instead of only a generic Crashpad stderr line.
try {
	const crashDumpsPath = app.getPath('crashDumps');
	console.log(`[CrashReporter] crash dumps path: ${crashDumpsPath}`);
	crashReporter.start({
		submitURL: '',
		uploadToServer: false,
	});
} catch (error) {
	console.error('[CrashReporter] Failed to start', error);
}

// Bootstrap new architecture - FULL INTEGRATION ENABLED
const services = bootstrapServices();
const { eventBus, appState, windowFactory, logger, windowContextManager, agentService } = services;
const mainWindow = new Main(appState, windowFactory, windowContextManager);
agentService.start(logger);
startRagSchedule(logger);
// Re-bind safety net with the real logger now that it exists.
setupProcessSafetyNet(logger);
setupMemoryMonitor(logger);
logger.info('CrashReporter', `Crash dumps path: ${app.getPath('crashDumps')}`);
logger.info('Main', 'Starting app');
logger.info('Main', 'Enabling IPC modules...');
registerIpcHandlers(services, eventBus, {
	openVoiceConversation: (chatSessionId) => mainWindow.openVoiceConversation(chatSessionId),
});
setupAppLifecycle(appState, logger);
setupEventLogging(logger);

const shortcutManager = new ShortcutManager();

app.on('browser-window-created', (_event, win) => {
	shortcutManager.attach(win);
});

const trayManager = new Tray({
	onToggleApp: () => mainWindow.toggleVisibility(),
	onQuit: () => {
		appState.setQuitting();
		app.quit();
	},
	isAppVisible: () => mainWindow.isVisible(),
	getApps: () => listApps(),
	onOpenApp: (app) => loadApp(windowFactory, app),
	getMicrophoneInputs: async () => {
		const win = mainWindow.getWindow();
		if (!win || win.isDestroyed()) return [];
		try {
			return await win.webContents.executeJavaScript(
				`(async () => {
					if (!navigator.mediaDevices?.enumerateDevices) return [];
					const devices = await navigator.mediaDevices.enumerateDevices();
					return devices
						.filter((device) => device.kind === 'audioinput' && device.deviceId !== 'default' && device.deviceId !== 'communications')
						.map((device, index) => ({ id: device.deviceId, label: device.label || 'Microphone ' + (index + 1) }));
				})()`,
				true
			);
		} catch {
			return [];
		}
	},
	getMicrophoneInputId: () => getMicrophoneInputId(),
	onMicrophoneInputChange: (inputId) => {
		setMicrophoneInputId(inputId);
		trayManager.updateContextMenu();
	},
});

const menuManager = new Menu({
	onLanguageChange: (lng) => {
		setStoredLanguage(lng as AppLanguage);
		trayManager.updateLanguage(lng);
		BrowserWindow.getAllWindows().forEach((win) => {
			win.webContents.send('change-language', lng);
		});
	},
	onNewWindow: () => {
		logger.info('Menu', 'Creating new launcher window');
		mainWindow.createAdditionalWindow();
	},
	getApps: () => listApps(),
	onOpenApp: (app) => loadApp(windowFactory, app),
	onOpenAppDataFolder: () => {
		void shell.openPath(app.getPath('userData'));
	},
	onOpenDataFolder: () => {
		mkdirSync(userDataLocation(), { recursive: true });
		void shell.openPath(userDataLocation());
	},
	getTrayEnabled,
	onTrayEnabledChange: (enabled) => {
		setStoredTrayEnabled(enabled);
		setTrayEnabled(trayManager, enabled);
		eventBus.broadcast(AppChannels.trayEnabledChanged, enabled);
	},
	getKeepAwake,
	onKeepAwakeChange: (enabled) => {
		setKeepAwake(enabled);
		setStoredKeepAwake(enabled);
		eventBus.broadcast(AppChannels.keepAwakeChanged, enabled);
	},
	getTheme,
	onThemeChange: (theme) => {
		setStoredTheme(theme);
		nativeTheme.themeSource = theme;
	},
});

app.whenReady().then(() => {
	recordAppLaunch();
	startStorageSync(logger, services.storageOperations);
	services.cloudService.initialize();
	services.providerSyncService.initialize();
	const authInitialization = services.authService.initialize();
	const unsubscribeAuthLinks = authLinks.subscribe(async (url) => {
		try {
			await services.authService.handleDeepLink(url);
		} catch (error) {
			logger.warn('Auth', 'Authentication callback failed', error);
		} finally {
			mainWindow.showOrCreate();
		}
	});
	app.once('before-quit', unsubscribeAuthLinks);
	void authInitialization.then(() => authLinks.flush());
	setKeepAwake(getKeepAwake());
	registerLocalResourceProtocolHandler(logger);
	setupMediaPermissionHandlers(services.appRegistry);
	ensureApps();
	const stopWatchingApps = watchApps(
		() => {
			menuManager.create();
			trayManager.updateContextMenu();
		},
		(error) => logger.error('Apps', 'App watcher failed', error)
	);
	app.once('before-quit', () => {
		void stopWatchingApps();
	});
	startWiki(logger);
	// Apply persisted settings on startup (updateLanguage builds the menu)
	const storedLanguage = getLanguage();
	menuManager.updateLanguage(storedLanguage);
	setTrayEnabled(trayManager, getTrayEnabled());
	trayManager.updateLanguage(storedLanguage);
	nativeTheme.themeSource = getTheme();

	// Toggle tray from renderer settings
	eventBus.on('tray:set-enabled', (event) => {
		const { enabled } = event.payload as { enabled: boolean };
		setTrayEnabled(trayManager, enabled);
	});

	// Sync native menu + tray when language changes from renderer settings
	eventBus.on('language:changed', (event) => {
		const { language } = event.payload as { language: AppLanguage };
		menuManager.updateLanguage(language);
		trayManager.updateLanguage(language);
	});

	// Create main window
	if (!mainWindow.getWindow()) mainWindow.create();

	// Start enabled messaging channels (registry skips disabled/unconfigured ones)
	for (const channel of CHANNEL_PROVIDER_IDS) {
		services.channelRegistry.start(channel).catch((error) => {
			logger.error('Main', `Failed to start ${channel} channel`, error);
		});
	}

	// Update tray menu when window visibility changes
	mainWindow.setOnWindowVisibilityChange(() => {
		trayManager.updateContextMenu();
	});

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0 && !trayManager.isCreated()) {
			mainWindow.create();
		}
	});
	app.on('browser-window-focus', () => services.providerSyncService.requestSync());
});

// Core window and quit-state handlers are managed by setupAppLifecycle.

app.on('will-quit', () => {
	setKeepAwake(false);
	services.terminalManager.shutdown();
});

let shutdownPromise: Promise<void> | undefined;
let shutdownComplete = false;
app.on('before-quit', (event) => {
	if (shutdownComplete) return;
	event.preventDefault();
	if (shutdownPromise) return;
	shutdownPromise = Promise.resolve().then(async () => {
		destroyAllApps();
		stopStorageSync();
		stopRagSchedule();
		stopWiki();
		await cleanup(services);
	});
	void shutdownPromise
		.catch((error) => {
			console.error('[Shutdown] Cleanup failed', error);
		})
		.finally(() => {
			shutdownComplete = true;
			app.quit();
		});
});
