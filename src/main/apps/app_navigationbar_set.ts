import { WindowChannels } from '../../shared/ipc_channels_definitions';
import type { AppNavigationBarOptions } from '../../shared/window_types';
import { openAppWindows } from './app_render';

export function setAppNavigationBar(
	appId: string,
	options: AppNavigationBarOptions | null
): void {
	const appWindow = openAppWindows.get(appId);
	if (!appWindow || appWindow.window.isDestroyed()) return;
	appWindow.navigationBarOptions = options;
	appWindow.window.webContents.send(WindowChannels.navigationBarOptionsChanged, options);
}
