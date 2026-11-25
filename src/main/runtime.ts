import { app, BrowserWindow, crashReporter, nativeTheme, powerMonitor, shell } from 'electron';
import { mkdirSync } from 'node:fs';
import { Main } from './create_window';
import { Tray } from './tray';
import { setTrayEnabled } from './set_tray_enabled';
import {
	getTrayEnabled,
	setTrayEnabled as setStoredTrayEnabled,
	getTrayClickAction,
	getKeepAwake,
	setKeepAwake as setStoredKeepAwake,
	getSoundFeedbackEnabled,
	setSoundFeedbackEnabled,
	getChatTextSize,
	setChatTextSize,
	getZoomFactor,
	setZoomFactor,
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
import { startUpdater } from './updater';
import { userDataLocation } from './shared/user_data_location';
import { destroyAllApps, ensureApps, watchApps } from './apps/app_index';
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
import { startStorageSync, stopStorageSync } from './backup';
import { startRagSchedule, stopRagSchedule } from './agent/knowledge/rag';
import { AgentChannels, AppChannels } from '../shared/ipc_channels_definitions';
import { watchSessions } from './agent/session/session_watch';
import { agentLocation } from './shared/agent_location';
import { authLinks } from './cloud/links';
import { pluginLinkId, pluginLinks } from './plugins/plugins_link';
import { loadLocalEnvironment } from './cloud/environment';
import { VoiceWindow } from './voice_window';
import { findBrowserProfiles } from './agent/permissions/browsers';
import { paneEvents } from './agent/tools/web/browser/pane';
import { history } from './browser/history';
import { restoreTabs } from './browser/restore';
import { configurePrivacy } from './privacy/configure';
import { isPrivacyEnabled, privacyChanged } from './privacy/state';
import { isVaultEnabled } from './vault/state';
import { saveTabs } from './browser/snapshot';
import { openAppWindows } from './apps/app_render';
import { watchIdle } from './lock/idle';
import { isLocked, lockChanged } from './lock/state';
import type { LockState } from '../shared/lock';

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
const voiceWindow = new VoiceWindow(windowFactory, windowContextManager);
if (!isPrivacyEnabled() && !isVaultEnabled()) {
	agentService.start(logger);
	startRagSchedule(logger);
}
privacyChanged.on('change', (state) => eventBus.broadcast(AppChannels.privacyChanged, state));
lockChanged.on('change', (state: LockState) => {
	eventBus.broadcast(AppChannels.lockChanged, state);
	if (!state.locked) return;
	voiceWindow.end();
	for (const { window } of openAppWindows.values()) {
		if (!window.isDestroyed()) window.hide();
	}
});
// Re-bind safety net with the real logger now that it exists.
setupProcessSafetyNet(logger);
setupMemoryMonitor(logger);
logger.info('CrashReporter', `Crash dumps path: ${app.getPath('crashDumps')}`);
logger.info('Main', 'Starting app');
logger.info('Main', 'Enabling IPC modules...');
registerIpcHandlers(services, eventBus, {
	openVoiceConversation: (chatSessionId) =>
		isLocked() ? mainWindow.showOrCreate() : voiceWindow.open(chatSessionId),
});
setupAppLifecycle(appState, logger);
setupEventLogging(logger);

const shortcutManager = new ShortcutManager();

app.on('browser-window-created', (_event, win) => {
	shortcutManager.attach(win);
});

const trayManager = new Tray({
	onToggleChat: () => mainWindow.toggleVisibility(),
	onStartPersona: () => (isLocked() ? mainWindow.showOrCreate() : voiceWindow.start()),
	onHidePersona: () => voiceWindow.hide(),
	onShowPersona: () => (isLocked() ? mainWindow.showOrCreate() : voiceWindow.show()),
	onQuit: () => {
		appState.setQuitting();
		app.quit();
	},
	isAppVisible: () => mainWindow.isVisible(),
	isPersonaActive: () => voiceWindow.isActive(),
	isPersonaVisible: () => voiceWindow.isVisible(),
	getTrayClickAction,
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

voiceWindow.setOnVisibilityChange(() => {
	trayManager.updateContextMenu();
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
	getSoundFeedbackEnabled,
	onSoundFeedbackEnabledChange: (enabled) => {
		setSoundFeedbackEnabled(enabled);
		eventBus.broadcast(AppChannels.soundFeedbackEnabledChanged, enabled);
	},
	getChatTextSize,
	onChatTextSizeChange: (size) => {
		setChatTextSize(size);
		eventBus.broadcast(AppChannels.chatTextSizeChanged, size);
	},
	getZoomFactor,
	onZoomFactorChange: (factor) => {
		setZoomFactor(factor);
		eventBus.broadcast(AppChannels.zoomFactorChanged, factor);
	},
	getTheme,
	onThemeChange: (theme) => {
		setStoredTheme(theme);
		nativeTheme.themeSource = theme;
	},
});

app.whenReady().then(async () => {
	if (isPrivacyEnabled()) {
		await configurePrivacy();
		agentService.start(logger);
		startRagSchedule(logger);
	}
	void services.memoryService
		.start()
		.catch((error) => logger.error('Memory', 'Failed to start memory processing', error));
	powerMonitor.on('resume', () => {
		void services.memoryService
			.refresh('wake')
			.catch((error) => logger.error('Memory', 'Wake refresh failed', error));
	});
	watchIdle();
	void findBrowserProfiles().catch((error) => logger.error('Permissions', 'Browser profile scan failed', error));
	recordAppLaunch();
	if (app.isPackaged && !isPrivacyEnabled()) startUpdater(eventBus, logger);
	startStorageSync(logger, services.storageOperations);
	services.cloudService.initialize();
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
	const unsubscribePluginLinks = pluginLinks.subscribe(async (url) => {
		const id = pluginLinkId(new URL(url));
		if (id) mainWindow.showRoute(`settings/plugins/marketplace/${id}`);
	});
	app.once('before-quit', unsubscribePluginLinks);
	void pluginLinks.flush();
	setKeepAwake(getKeepAwake());
	registerLocalResourceProtocolHandler(logger);
	setupMediaPermissionHandlers(services.appRegistry);
	ensureApps();
	const stopWatchingApps = watchApps(
		() => {
			menuManager.create();
		},
		(error) => logger.error('Apps', 'App watcher failed', error)
	);
	app.once('before-quit', () => {
		void stopWatchingApps();
	});
	watchSessions(agentLocation(), () => eventBus.broadcast(AgentChannels.sessionsChanged));
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

	restoreTabs();
	paneEvents.on('change', () => saveTabs());
	app.once('before-quit', () => {
		saveTabs(true);
		history(undefined, true);
	});

	// Create main window
	if (!mainWindow.getWindow()) mainWindow.create();

	// Update tray menu when window visibility changes
	mainWindow.setOnWindowVisibilityChange(() => {
		trayManager.updateContextMenu();
	});

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0 && !trayManager.isCreated()) {
			mainWindow.create();
		}
	});
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
