import { WindowChannels } from '../../shared/ipc_channels_definitions';
import type { AppTitlebarOptions } from '../../shared/window_types';
import { openAppWindows } from './app_render';

export function setAppTitlebar(
	appId: string,
	options: AppTitlebarOptions | null
): void {
	const appWindow = openAppWindows.get(appId);
	if (!appWindow || appWindow.window.isDestroyed()) return;
	appWindow.titlebarOptions = options;
	appWindow.window.webContents.send(WindowChannels.titlebarOptionsChanged, options);
}
