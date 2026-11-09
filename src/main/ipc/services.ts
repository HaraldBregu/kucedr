import { ipcMain } from 'electron';
import { ServicesChannels } from '../../shared/ipc_channels_definitions';
import { loadWebSearches } from '../models';
import { wrapSimpleHandler } from './core/error_handler';
import type { IpcModule } from './core/module';

export class ServicesIpc implements IpcModule {
	readonly name = 'services';

	register(): void {
		ipcMain.handle(
			ServicesChannels.list,
			wrapSimpleHandler(() => [...loadWebSearches()], ServicesChannels.list)
		);
	}
}
