import { dialog } from 'electron';
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
		registerCommandWithEvent(LibraryChannels.add, (event, paths) => {
			trusted.assert(event);
			return library.addLibraryFiles(paths);
		});
		registerCommandWithEvent(LibraryChannels.select, async (event) => {
			const window = trusted.assert(event);
			const result = await dialog.showOpenDialog(window, {
				title: 'Upload files to Library',
				properties: ['openFile', 'multiSelections'],
			});
			if (result.canceled || result.filePaths.length === 0) return undefined;
			return library.addLibraryFiles(result.filePaths);
		});
		registerCommandWithEvent(LibraryChannels.delete, (event, relativePath) => {
			trusted.assert(event);
			return library.deleteLibraryFile(relativePath);
		});
		registerCommandWithEvent(LibraryChannels.createFolder, (event, name) => {
			trusted.assert(event);
			return library.createLibraryFolder(name);
		});
		registerCommandWithEvent(LibraryChannels.move, (event, relativePaths, destinationFolder) => {
			trusted.assert(event);
			return library.moveLibraryEntries(relativePaths, destinationFolder);
		});
		registerCommandWithEvent(LibraryChannels.download, (event, relativePaths) => {
			const window = trusted.assert(event);
			return library.downloadLibraryFiles(window, relativePaths);
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
