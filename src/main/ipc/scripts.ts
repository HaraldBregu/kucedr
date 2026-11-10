import type { AppRegistry } from '../apps/app_registry';
import type { WindowContextManager } from '../window_context';
import { ScriptsChannels } from '../../shared/ipc_channels_definitions';
import { PLUGIN_SCRIPT_TYPES } from '../../shared/plugin_types';
import * as plugins from '../plugins';
import { registerCommandWithEvent, registerQueryWithEvent } from './core/gateway';
import type { IpcModule } from './core/module';
import { TrustedRenderer } from './core/trusted';

export interface ScriptsIpcDependencies {
	windows: WindowContextManager;
	apps: AppRegistry;
}

export class ScriptsIpc implements IpcModule<ScriptsIpcDependencies> {
	readonly name = 'scripts';

	register({ windows, apps }: ScriptsIpcDependencies): void {
		const trusted = new TrustedRenderer(windows, apps);

		registerQueryWithEvent(ScriptsChannels.list, (event) => {
			trusted.assert(event);
			return PLUGIN_SCRIPT_TYPES.flatMap((type) => plugins.pluginScripts(type)).map(
				({
					name,
					title,
					description,
					type,
					author,
					metadata,
					inputSchema,
					fence,
					height,
					plugin,
				}) => ({
					name,
					title,
					description,
					type,
					...(author && { author }),
					version: metadata.version,
					category: metadata.category,
					...(inputSchema && { inputSchema }),
					...(fence && { fence }),
					height,
					plugin,
				})
			);
		});
		registerQueryWithEvent(
			ScriptsChannels.render,
			(event, name: string, input: unknown, theme: 'light' | 'dark') => {
				trusted.assert(event);
				return plugins.renderPluginScript(name, input, theme === 'dark' ? 'dark' : 'light');
			}
		);
	}
}
