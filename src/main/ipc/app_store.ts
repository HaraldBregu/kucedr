import type { IpcMainInvokeEvent } from 'electron';
import { AppChannels } from '../../shared/ipc_channels_definitions';
import type { AppRegistry } from '../apps/app_registry';
import type { AppStorage } from '../apps/app_store';
import { registerCommandWithEvent, registerQueryWithEvent } from './core/gateway';

export interface AppStoreIpcDeps {
	appRegistry: AppRegistry;
	appStorage: AppStorage;
}

export function registerAppStoreIpc({
	appRegistry,
	appStorage,
}: AppStoreIpcDeps): void {
	const appId = (event: IpcMainInvokeEvent): string =>
		appRegistry.resolve(event.sender);

	registerQueryWithEvent(AppChannels.getAppStoreValue, (event, key) =>
		appStorage.get(appId(event), key)
	);
	registerCommandWithEvent(AppChannels.setAppStoreValue, (event, key, value) =>
		appStorage.set(appId(event), key, value)
	);
	registerCommandWithEvent(AppChannels.deleteAppStoreValue, (event, key) =>
		appStorage.delete(appId(event), key)
	);
	registerQueryWithEvent(AppChannels.readAppStoreFile, (event, filePath) =>
		appStorage.readFile(appId(event), filePath)
	);
	registerCommandWithEvent(AppChannels.writeAppStoreFile, (event, filePath, data) =>
		appStorage.writeFile(appId(event), filePath, data)
	);
	registerCommandWithEvent(AppChannels.deleteAppStoreFile, (event, filePath) =>
		appStorage.deleteFile(appId(event), filePath)
	);
}
