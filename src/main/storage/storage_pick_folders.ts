import { BrowserWindow, dialog } from 'electron';
import { userDataLocation } from '../shared/user_data_location';

export async function pickFolders(): Promise<string[]> {
	const options = {
		defaultPath: userDataLocation(),
		properties: ['openDirectory' as const, 'multiSelections' as const],
	};
	const window = BrowserWindow.getFocusedWindow();
	const result = await (window
		? dialog.showOpenDialog(window, options)
		: dialog.showOpenDialog(options));
	return result.canceled ? [] : result.filePaths;
}
