import type { IpcModule } from './core/module';
import type { EventBus } from '../event_bus';
import { registerCommandWithEvent, registerQueryWithEvent } from './core/gateway';
import { StorageChannels } from '../../shared/ipc_channels_definitions';
import {
	getStorageSettings,
	pickFolders,
	rescheduleStorageSync,
	saveStorageSettings,
	syncFolders,
} from '../storage';
import type { StorageOperations } from '../storage';
import type { AppRegistry } from '../apps/app_registry';
import type { WindowContextManager } from '../window_context';
import { TrustedRenderer } from './core/trusted';
import { storageProviders } from '../storage/providers';
import { getEnabledPluginProviders } from '../providers/providers_store';
import { loadStorages } from '../models';
import type { AuthService } from '../cloud/service';
import { loadCloudConfig } from '../cloud/config';
import { configureVersionedStorage } from '../storage/cloud/configure';
import { readStorageConfig } from '../storage/local/config';
import { writeStorageConfig } from '../storage/local/config_write';
import { openStorageState } from '../storage/local/state';
import { listStorageConflicts } from '../storage/local/conflicts';

export interface StorageIpcDeps {
	appRegistry: AppRegistry;
	storageOperations: StorageOperations;
	windows: WindowContextManager;
	authService: AuthService;
}

export class StorageIpc implements IpcModule<StorageIpcDeps> {
	readonly name = 'storage';

	register(
		{ appRegistry, storageOperations, windows, authService }: StorageIpcDeps,
		_eventBus: EventBus
	): void {
		const trusted = new TrustedRenderer(windows, appRegistry);
		registerQueryWithEvent(StorageChannels.listProviders, (event) => {
			trusted.assert(event);
			return storageProviders.list();
		});
		registerCommandWithEvent(StorageChannels.saveProvider, (event, input) => {
			trusted.assert(event);
			if (
				!input?.id &&
				!loadStorages().some((entry) =>
					getEnabledPluginProviders().storage.includes(`${entry.provider.id}/${entry.id}`)
				)
			) {
				throw new Error('Enable a storage provider in Plugins before adding a connection.');
			}
			if (
				storageOperations.isRunning() &&
				input?.id &&
				input.id === getStorageSettings().providerId
			) {
				throw new Error(
					'The selected storage provider cannot change while a cloud operation is running.'
				);
			}
			return storageProviders.save(input);
		});
		registerCommandWithEvent(StorageChannels.removeProvider, (event, id) => {
			trusted.assert(event);
			const settings = getStorageSettings();
			const selected = settings.providerId === id;
			if (selected && storageOperations.isRunning()) {
				throw new Error(
					'The selected storage provider cannot be removed while a cloud operation is running.'
				);
			}
			const removed = storageProviders.remove(id);
			if (removed && selected) {
				saveStorageSettings({ ...settings, providerId: undefined, syncEnabled: false });
				rescheduleStorageSync();
			}
			return removed;
		});
		registerQueryWithEvent(StorageChannels.getSettings, (event) => {
			trusted.assert(event);
			return getStorageSettings();
		});
		registerCommandWithEvent(StorageChannels.saveSettings, (event, settings) => {
			trusted.assert(event);
			if (storageOperations.isRunning()) {
				throw new Error('Storage settings cannot change while a cloud operation is running.');
			}
			const saved = saveStorageSettings(settings);
			rescheduleStorageSync();
			return saved;
		});
		registerQueryWithEvent(StorageChannels.getVersionedStatus, async (event) => {
			trusted.assert(event);
			return (await readStorageConfig())?.sync.enabled ?? false;
		});
		registerCommandWithEvent(StorageChannels.setVersionedEnabled, async (event, enabled) => {
			trusted.assert(event);
			if (storageOperations.isRunning()) throw new Error('Wait for the current storage operation.');
			if (typeof enabled !== 'boolean') throw new Error('Invalid storage mode.');
			if (!enabled) {
				const config = await readStorageConfig();
				if (config)
					await writeStorageConfig({ ...config, sync: { ...config.sync, enabled: false } });
				return false;
			}
			if (!authService.getSignedInUserId())
				throw new Error('Sign in before enabling cloud file sync.');
			const cloud = loadCloudConfig();
			if (!cloud) throw new Error('Supabase account services are unavailable.');
			const settings = getStorageSettings();
			if (!settings.paths.length) throw new Error('Select at least one folder to synchronize.');
			await configureVersionedStorage(settings, cloud.url, true);
			return true;
		});
		registerQueryWithEvent(StorageChannels.listConflicts, async (event) => {
			trusted.assert(event);
			const accountId = authService.getSignedInUserId();
			const config = await readStorageConfig();
			if (!accountId || !config?.sync.enabled) return [];
			const database = openStorageState();
			try {
				return config.workspaces.flatMap((workspace) =>
					listStorageConflicts(database, {
						accountId,
						workspaceId: workspace.id,
					})
				);
			} finally {
				database.close();
			}
		});
		registerQueryWithEvent(StorageChannels.syncFolders, (event) => {
			trusted.assert(event);
			return syncFolders();
		});
		registerCommandWithEvent(StorageChannels.pickFolders, (event) => {
			trusted.assert(event);
			return pickFolders();
		});
		registerQueryWithEvent(StorageChannels.getOperationStatus, (event) => {
			trusted.assert(event);
			return storageOperations.getStatus();
		});
		registerCommandWithEvent(StorageChannels.backup, (event) => {
			trusted.assert(event);
			return storageOperations.backup('manual');
		});
		registerCommandWithEvent(StorageChannels.restore, (event) => {
			trusted.assert(event);
			return storageOperations.restore();
		});
	}
}
