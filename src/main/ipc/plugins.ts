import { dialog } from 'electron';
import type { EventBus } from '../event_bus';
import type { AppRegistry } from '../apps/app_registry';
import type { WindowContextManager } from '../window_context';
import { AppChannels, PluginsChannels } from '../../shared/ipc_channels_definitions';
import * as plugins from '../plugins';
import { refreshProviderCatalog } from '../models';
import { registerCommandWithEvent, registerQueryWithEvent } from './core/gateway';
import type { IpcModule } from './core/module';
import { TrustedRenderer } from './core/trusted';

export interface PluginsIpcDependencies {
	windows: WindowContextManager;
	apps: AppRegistry;
}

export class PluginsIpc implements IpcModule<PluginsIpcDependencies> {
	readonly name = 'plugins';

	register({ windows, apps }: PluginsIpcDependencies, eventBus: EventBus): void {
		const trusted = new TrustedRenderer(windows, apps);
		const changed = (): void => {
			plugins.refreshPlugins();
			refreshProviderCatalog();
			eventBus.broadcast(AppChannels.modelsChanged);
		};
		plugins.watchPlugins(changed);

		registerQueryWithEvent(PluginsChannels.list, (event) => {
			trusted.assert(event);
			return plugins.listPlugins();
		});
		registerCommandWithEvent(PluginsChannels.installUrl, async (event, url: string) => {
			trusted.assert(event);
			const installed = await plugins.downloadPlugin(url);
			changed();
			return installed;
		});
		registerCommandWithEvent(PluginsChannels.upload, async (event, path?: string) => {
			trusted.assert(event);
			const installed = await plugins.uploadPlugin(path);
			if (installed) changed();
			return installed;
		});
		registerCommandWithEvent(PluginsChannels.remove, async (event, id: string) => {
			trusted.assert(event);
			await plugins.removePlugin(id);
			changed();
		});
		registerCommandWithEvent(PluginsChannels.setEnabled, (event, id: string, enabled: boolean) => {
			trusted.assert(event);
			plugins.setPluginEnabled(id, enabled);
			changed();
		});
		registerQueryWithEvent(PluginsChannels.listExtensions, (event) => {
			trusted.assert(event);
			return plugins.listExtensions();
		});
		registerCommandWithEvent(PluginsChannels.importExtensions, async (event, paths?: string[]) => {
			const window = trusted.assert(event);
			if (paths?.length) return plugins.importExtensions(paths);
			const result = await dialog.showOpenDialog(window, {
				title: 'Select extension folder(s)',
				properties: ['openDirectory', 'multiSelections'],
			});
			return result.canceled ? undefined : plugins.importExtensions(result.filePaths);
		});
		registerCommandWithEvent(PluginsChannels.removeExtension, async (event, id: string) => {
			const window = trusted.assert(event);
			const result = await dialog.showMessageBox(window, {
				type: 'warning',
				title: 'Remove Extension',
				buttons: ['Cancel', 'Remove Extension'],
				cancelId: 0,
				defaultId: 0,
				noLink: true,
				message: `Remove “${id}”?`,
				detail: 'This deletes the extension folder from Kucedr. You can import it again later.',
			});
			if (result.response !== 1) return false;
			await plugins.removeExtension(id);
			return true;
		});
	}
}
