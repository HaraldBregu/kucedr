import { WindowChannels } from '../../shared/ipc_channels_definitions';
import type { AppNavigationbarOptions } from '../../shared/window_types';
import { openAppWindows } from './app_render';

export function setAppNavigationbar(
	appId: string,
	options: AppNavigationbarOptions | null
): void {
	const appWindow = openAppWindows.get(appId);
	if (!appWindow || appWindow.window.isDestroyed()) return;
	appWindow.navigationbarOptions = options;
	appWindow.window.webContents.send(WindowChannels.navigationbarOptionsChanged, options);
}
