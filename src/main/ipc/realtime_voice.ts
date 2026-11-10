import { BrowserWindow } from 'electron';
import { RealtimeVoiceChannels } from '../../shared/ipc_channels_definitions';
import type { EventBus } from '../event_bus';
import type { AppRegistry } from '../apps/app_registry';
import type { WindowContextManager } from '../window_context';
import type { RealtimeVoiceManager } from '../agent/realtime_voice';
import type { IpcModule } from './core/module';
import { openAppWindows } from '../apps/app_render';
import { ModelRenderer } from './core/model';

export interface RealtimeVoiceIpcDependencies {
	voice: RealtimeVoiceManager;
	windows: WindowContextManager;
	apps: AppRegistry;
}

export class RealtimeVoiceIpc implements IpcModule<RealtimeVoiceIpcDependencies> {
	readonly name = 'realtime-voice';

	register({ voice, windows, apps }: RealtimeVoiceIpcDependencies, _eventBus: EventBus): void {
		const trusted = new ModelRenderer(windows, apps);
		trusted.commandWithEvent(RealtimeVoiceChannels.startSession, (event, request) =>
			voice.start(windowId(event.sender, apps), request)
		);
		trusted.commandWithEvent(RealtimeVoiceChannels.appendAudio, (event, sessionId, audio) =>
			voice.appendAudio(windowId(event.sender, apps), sessionId, audio)
		);
		trusted.commandWithEvent(RealtimeVoiceChannels.interruptSession, (event, sessionId) =>
			voice.interrupt(windowId(event.sender, apps), sessionId)
		);
		trusted.commandWithEvent(RealtimeVoiceChannels.stopSession, (event, sessionId) =>
			voice.stop(windowId(event.sender, apps), sessionId)
		);
	}
}

function windowId(sender: Electron.WebContents, apps: AppRegistry): number {
	if (apps.has(sender)) {
		const appWindow = openAppWindows.get(apps.resolve(sender))?.window;
		if (!appWindow || appWindow.isDestroyed()) {
			throw new Error('Realtime voice requires an active app window.');
		}
		return appWindow.id;
	}
	const window = BrowserWindow.fromWebContents(sender);
	if (!window || window.isDestroyed()) throw new Error('Realtime voice requires an active window.');
	return window.id;
}
