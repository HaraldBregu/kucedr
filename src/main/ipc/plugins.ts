import type { EventBus } from '../event_bus';
import type { AppRegistry } from '../apps/app_registry';
import type { WindowContextManager } from '../window_context';
import { AppChannels, PluginsChannels } from '../../shared/ipc_channels_definitions';
import * as plugins from '../plugins';
import { configuredPluginSettings } from '../plugins/configured';
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
			eventBus.broadcast(AppChannels.themesChanged);
			eventBus.emit('plugins:changed', {});
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
		registerQueryWithEvent(PluginsChannels.available, (event) => {
			trusted.assert(event);
			return plugins.availablePlugins();
		});
		registerCommandWithEvent(PluginsChannels.installCatalog, async (event, id: string) => {
			trusted.assert(event);
			const installed = await plugins.installCatalogPlugin(id);
			changed();
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
		registerQueryWithEvent(PluginsChannels.getSettings, (event, id: string) => {
			trusted.assert(event);
			return configuredPluginSettings(id);
		});
		registerCommandWithEvent(
			PluginsChannels.saveSettings,
			(event, id: string, key: string, value: string | null) => {
				trusted.assert(event);
				if (typeof key !== 'string' || (value !== null && typeof value !== 'string'))
					throw new Error('Invalid plugin setting.');
				plugins.savePluginSettings(id, { [key]: value });
				changed();
			}
		);
	}
}
