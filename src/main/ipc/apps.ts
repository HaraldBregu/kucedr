import { dialog } from 'electron';
import type { EventBus } from '../event_bus';
import type { WindowFactory } from '../window_factory';
import type { AppRegistry } from '../apps/app_registry';
import type { AppStorage } from '../apps/app_store';
import {
	deleteApp,
	addDebugApp,
	destroyApp,
	importApps,
	listApps,
	loadApp,
	openRoot,
	writeAppWindowSettings,
} from '../apps/app_index';
import { AppsChannels } from '../../shared/ipc_channels_definitions';
import type { AppImportResult } from '../../shared/installed_app_types';
import { registerCommandWithEvent, registerQueryWithEvent } from './core/gateway';
import type { IpcModule } from './core/module';
import type { WindowContextManager } from '../window_context';
import { TrustedRenderer } from './core/trusted';
import { resolveAppWindowSettings } from '../../shared/app_window_resolve';

export interface AppsIpcDeps {
	windowFactory: WindowFactory;
	appRegistry: AppRegistry;
	windows: WindowContextManager;
	appStorage: AppStorage;
}

export class AppsIpc implements IpcModule<AppsIpcDeps> {
	readonly name = 'apps';

	register(
		{ windowFactory, appRegistry, windows, appStorage }: AppsIpcDeps,
		_eventBus: EventBus
	): void {
		const trusted = new TrustedRenderer(windows, appRegistry);
		registerQueryWithEvent(AppsChannels.getSettings, (event, appId) => {
			trusted.assert(event);
			const app = listApps().find((item) => item.id === appId);
			if (!app) throw new Error(`App not found: ${appId}`);
			return resolveAppWindowSettings(app.window ?? {});
		});
		registerCommandWithEvent(AppsChannels.setSettings, (event, appId, settings) => {
			trusted.assert(event);
			const app = listApps().find((item) => item.id === appId);
			if (!app) throw new Error(`App not found: ${appId}`);
			return writeAppWindowSettings(app.id, settings);
		});
		registerQueryWithEvent(AppsChannels.list, (event) => {
			trusted.assert(event);
			return listApps();
		});
		registerCommandWithEvent(AppsChannels.open, (event, appId: string) => {
			trusted.assert(event);
			const app = listApps().find((item) => item.id === appId);
			if (!app) throw new Error(`App not found: ${appId}`);
			if ((app.mode ?? 'extension') === 'extension') {
				throw new Error(`${app.title} only opens inside Kucedr.`);
			}
			loadApp(windowFactory, app);
		});
		registerCommandWithEvent(AppsChannels.openRoot, (event) => {
			trusted.assert(event);
			return openRoot();
		});
		registerCommandWithEvent(AppsChannels.delete, async (event, appId) => {
			const window = trusted.assert(event);
			const app = listApps().find((item) => item.id === appId);
			if (!app) throw new Error(`App not found: ${appId}`);
			const options = {
				type: 'warning' as const,
				title: 'Delete App',
				buttons: ['Cancel', 'Delete App'],
				cancelId: 0,
				defaultId: 0,
				noLink: true,
				message: `${app.debugPath ? 'Remove' : 'Delete'} “${app.title}”?`,
				detail: app.debugPath
					? 'This removes the debug folder from Kucedr without deleting files from the source folder.'
					: 'This permanently deletes the app and all of its stored data from Kucedr. This action cannot be undone.',
			};
			const result = await dialog.showMessageBox(window, options);
			if (result.response !== 1) return false;
			destroyApp(appId);
			appRegistry.revoke(appId);
			deleteApp(appId);
			return true;
		});
		registerCommandWithEvent(
			AppsChannels.import,
			async (event, paths?: string[]): Promise<AppImportResult | undefined> => {
				const window = trusted.assert(event);
				if (paths?.length) return importApps(paths);
				const result = await dialog.showOpenDialog(window, {
					title: 'Select app folder(s)',
					properties: ['openDirectory', 'multiSelections'],
				});

				if (result.canceled || result.filePaths.length === 0) return undefined;
				return importApps(result.filePaths);
			}
		);
		registerCommandWithEvent(AppsChannels.addDebug, (event, folderPath) => {
			trusted.assert(event);
			return addDebugApp(folderPath);
		});
		registerQueryWithEvent(AppsChannels.selectDebugPath, async (event) => {
			const window = trusted.assert(event);
			const result = await dialog.showOpenDialog(window, {
				title: 'Select debug app folder',
				properties: ['openDirectory'],
			});
			return result.canceled ? undefined : result.filePaths[0];
		});
		const extensionApp = (appId: string): string => {
			const app = listApps().find((item) => item.id === appId);
			if (!app || app.mode === 'window') throw new Error(`App not found: ${appId}`);
			return app.id;
		};
		registerQueryWithEvent(AppsChannels.getStoreValue, (event, appId, key) => {
			trusted.assert(event);
			return appStorage.get(extensionApp(appId), key);
		});
		registerCommandWithEvent(AppsChannels.setStoreValue, (event, appId, key, value) => {
			trusted.assert(event);
			appStorage.set(extensionApp(appId), key, value);
		});
		registerCommandWithEvent(AppsChannels.deleteStoreValue, (event, appId, key) => {
			trusted.assert(event);
			appStorage.delete(extensionApp(appId), key);
		});
	}
}
