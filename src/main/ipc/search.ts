import type { EventBus } from '../event_bus';
import {
	getSearchSettings,
	getStoredSearchProviders,
	saveSearchEngine,
	selectSearchEngine,
} from '../search';
import { SearchChannels } from '../../shared/ipc_channels_definitions';
import type { AppRegistry } from '../apps/app_registry';
import type { WindowContextManager } from '../window_context';
import { registerCommandWithEvent, registerQueryWithEvent } from './core/gateway';
import type { IpcModule } from './core/module';
import { TrustedRenderer } from './core/trusted';

export interface SearchIpcDeps {
	windows: WindowContextManager;
	apps: AppRegistry;
}

export class SearchIpc implements IpcModule<SearchIpcDeps> {
	readonly name = 'search';

	register({ windows, apps }: SearchIpcDeps, _eventBus: EventBus): void {
		const trusted = new TrustedRenderer(windows, apps);
		registerQueryWithEvent(SearchChannels.getSettings, (event) => {
			trusted.assert(event);
			return getSearchSettings();
		});
		registerQueryWithEvent(SearchChannels.listProviders, (event) => {
			trusted.assert(event);
			return getStoredSearchProviders();
		});
		registerCommandWithEvent(SearchChannels.saveEngine, (event, engineId, input) => {
			trusted.assert(event);
			return saveSearchEngine(engineId, input);
		});
		registerCommandWithEvent(SearchChannels.selectEngine, (event, engineId) => {
			trusted.assert(event);
			return selectSearchEngine(engineId);
		});
	}
}
