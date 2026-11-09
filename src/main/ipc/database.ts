import type { IpcModule } from './core/module';
import type { EventBus } from '../event_bus';
import { DatabaseChannels } from '../../shared/ipc_channels_definitions';
import { getDatabaseConfiguration, saveDatabaseConfiguration } from '../database/database_store';
import { listVectorDatabases } from '../database/vector_adapters';
import { saveVectorScriptKey, vectorScriptKey } from '../database/vector_keys';
import { pluginScripts } from '../plugins';
import type { AppRegistry } from '../apps/app_registry';
import type { WindowContextManager } from '../window_context';
import { TrustedRenderer } from './core/trusted';

export interface DatabaseIpcDependencies {
	windows: WindowContextManager;
	apps: AppRegistry;
}

export class DatabaseIpc implements IpcModule<DatabaseIpcDependencies> {
	readonly name = 'database';

	register({ windows, apps }: DatabaseIpcDependencies, _eventBus: EventBus): void {
		const trusted = new TrustedRenderer(windows, apps);
		trusted.query(DatabaseChannels.list, () => [...listVectorDatabases()]);
		trusted.query(DatabaseChannels.getConfiguration, () => getDatabaseConfiguration());
		trusted.command(DatabaseChannels.saveConfiguration, (configuration) =>
			saveDatabaseConfiguration(configuration)
		);
		trusted.query(DatabaseChannels.hasKey, (script) => Boolean(vectorScriptKey(vectorScript(script))));
		trusted.command(DatabaseChannels.saveKey, (script, apiKey) => {
			if (typeof apiKey !== 'string' || !apiKey.trim() || apiKey.length > 4_096)
				throw new Error('The API key is invalid.');
			saveVectorScriptKey(vectorScript(script), apiKey.trim());
		});
	}
}
