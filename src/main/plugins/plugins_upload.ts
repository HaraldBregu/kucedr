import { stat } from 'node:fs/promises';
import { dialog } from 'electron';
import type { PluginInfo } from '../../shared/plugin_types';
import { installPlugin } from './plugins_install';
import { installPluginArchive } from './plugins_install_archive';

export async function uploadPlugin(path?: string): Promise<PluginInfo | undefined> {
	let source = path;
	if (!source) {
		// ponytail: Windows and Linux dialogs can't pick files and folders at once, so they get folders only
		const result = await dialog.showOpenDialog({
			title: 'Select a plugin folder or .tgz archive',
			properties: process.platform === 'darwin' ? ['openFile', 'openDirectory'] : ['openDirectory'],
			filters: [{ name: 'Plugin archive', extensions: ['tgz'] }],
		});
		source = result.canceled ? undefined : result.filePaths[0];
	}
	if (!source) return undefined;
	return (await stat(source)).isDirectory() ? installPlugin(source) : installPluginArchive(source);
}
