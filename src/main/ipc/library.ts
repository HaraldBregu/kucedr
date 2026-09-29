import type { EventBus } from '../event_bus';
import type { AppRegistry } from '../apps/app_registry';
import type { WindowContextManager } from '../window_context';
import { LibraryChannels } from '../../shared/ipc_channels_definitions';
import * as library from '../library';
import { registerCommandWithEvent, registerQueryWithEvent } from './core/gateway';
import type { IpcModule } from './core/module';
import { TrustedRenderer } from './core/trusted';

export interface LibraryIpcDependencies {
	windows: WindowContextManager;
	apps: AppRegistry;
}

export class LibraryIpc implements IpcModule<LibraryIpcDependencies> {
	readonly name = 'library';

	register({ windows, apps }: LibraryIpcDependencies, _eventBus: EventBus): void {
		const trusted = new TrustedRenderer(windows, apps);
		registerQueryWithEvent(LibraryChannels.list, (event) => {
			trusted.assert(event);
			return library.listLibraryFiles();
		});
		registerCommandWithEvent(LibraryChannels.openRoot, (event) => {
			trusted.assert(event);
			return library.openLibraryRoot();
		});
		registerQueryWithEvent(LibraryChannels.getRoot, (event) => {
			trusted.assert(event);
			return library.getLibraryRoot();
		});
	}
}
