import type { WebContents } from 'electron';
import { WindowChannels } from '../../shared/ipc_channels_definitions';
import { openAppWindows } from './app_render';

export function dispatchAppTitlebarButton(sender: WebContents, buttonId: string): void {
	for (const appWindow of openAppWindows.values()) {
		if (appWindow.window.webContents !== sender) continue;
		const options = appWindow.titlebarOptions;
		const button = [...(options?.leftButtons ?? []), ...(options?.rightButtons ?? [])].find(
			(item) => item.id === buttonId
		);
		if (!button || button.disabled) return;
		if (!appWindow.contents || appWindow.contents.isDestroyed()) return;
		appWindow.contents.send(WindowChannels.titlebarButtonClicked, buttonId);
		return;
	}
}
