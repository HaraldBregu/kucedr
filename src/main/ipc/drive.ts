import { dialog } from 'electron';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { EventBus } from '../event_bus';
import type { AppRegistry } from '../apps/app_registry';
import type { WindowContextManager } from '../window_context';
import type { IpcModule } from './core/module';
import { registerCommandWithEvent, registerQueryWithEvent } from './core/gateway';
import { TrustedRenderer } from './core/trusted';
import { DriveChannels } from '../../shared/ipc_channels_definitions';
import { getMcpOauth } from '../mcp';
import { DriveClient } from '../drive/client';

export class DriveIpc implements IpcModule<{ windows: WindowContextManager; apps: AppRegistry }> {
	readonly name = 'drive';
	private selectedFolder?: string;

	register({ windows, apps }: { windows: WindowContextManager; apps: AppRegistry }, _eventBus: EventBus): void {
		const trusted = new TrustedRenderer(windows, apps);
		const drive = new DriveClient();
		registerQueryWithEvent(DriveChannels.status, (event) => {
			trusted.assert(event);
			return Boolean(getMcpOauth('google-drive').tokens?.access_token);
		});
		registerQueryWithEvent(DriveChannels.list, (event, query, meetOnly) => {
			trusted.assert(event);
			return drive.list(query, meetOnly);
		});
		registerQueryWithEvent(DriveChannels.read, (event, id) => {
			trusted.assert(event);
			return drive.read(id);
		});
		registerCommandWithEvent(DriveChannels.create, (event, input) => {
			trusted.assert(event);
			return drive.create(input);
		});
		registerCommandWithEvent(DriveChannels.update, (event, id, input) => {
			trusted.assert(event);
			return drive.update(id, input);
		});
		registerCommandWithEvent(DriveChannels.trash, (event, id) => {
			trusted.assert(event);
			return drive.trash(id);
		});
		registerCommandWithEvent(DriveChannels.download, async (event, id) => {
			const window = trusted.assert(event);
			const { bytes, name } = await drive.download(id);
			const options = { defaultPath: name, title: 'Download from Google Drive' };
			const selected = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);
			if (!selected.filePath) return '';
			await writeFile(selected.filePath, bytes);
			return selected.filePath;
		});
		registerCommandWithEvent(DriveChannels.chooseFolder, async (event) => {
			const window = trusted.assert(event);
			const options: Electron.OpenDialogOptions = { title: 'Choose a folder to back up to Google Drive', properties: ['openDirectory'] };
			const selected = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
			this.selectedFolder = selected.filePaths[0];
			return this.selectedFolder;
		});
		registerCommandWithEvent(DriveChannels.sync, (event, folderPath) => {
			trusted.assert(event);
			if (!this.selectedFolder || folderPath !== this.selectedFolder) throw new Error('Choose the local folder before backing it up.');
			return drive.sync(join(this.selectedFolder));
		});
	}
}
