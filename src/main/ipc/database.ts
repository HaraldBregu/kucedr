import type { IpcModule } from './core/module';
import type { EventBus } from '../event_bus';
import { DatabaseChannels } from '../../shared/ipc_channels_definitions';
import { getDatabaseConfiguration, saveDatabaseConfiguration } from '../database/database_store';
import { listVectorDatabases } from '../database/vector_adapters';
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
		trusted.query(DatabaseChannels.list, () => listVectorDatabases());
		trusted.query(DatabaseChannels.getConfiguration, () => getDatabaseConfiguration());
		trusted.command(DatabaseChannels.saveConfiguration, (configuration) =>
			saveDatabaseConfiguration(configuration)
		);
	}
}
