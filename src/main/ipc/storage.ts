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

export interface StorageIpcDeps {
	appRegistry: AppRegistry;
	storageOperations: StorageOperations;
	windows: WindowContextManager;
}

export class StorageIpc implements IpcModule<StorageIpcDeps> {
	readonly name = 'storage';

	register({ appRegistry, storageOperations, windows }: StorageIpcDeps, _eventBus: EventBus): void {
		const trusted = new TrustedRenderer(windows, appRegistry);
		registerQueryWithEvent(StorageChannels.listProviders, (event) => {
			trusted.assert(event);
			return storageProviders.list();
		});
		registerCommandWithEvent(StorageChannels.saveProvider, (event, input) => {
			trusted.assert(event);
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
