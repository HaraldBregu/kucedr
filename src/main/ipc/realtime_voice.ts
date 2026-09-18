import { BrowserWindow } from 'electron';
import { RealtimeVoiceChannels } from '../../shared/ipc_channels_definitions';
import type { EventBus } from '../event_bus';
import type { AppRegistry } from '../apps/app_registry';
import type { WindowContextManager } from '../window_context';
import type { Conversation } from '../agent/conversation';
import type { IpcModule } from './core/module';
import { openAppWindows } from '../apps/app_render';
import { ModelRenderer } from './core/model';

export interface RealtimeVoiceIpcDependencies {
	conversation: Conversation;
	windows: WindowContextManager;
	apps: AppRegistry;
}

export class RealtimeVoiceIpc implements IpcModule<RealtimeVoiceIpcDependencies> {
	readonly name = 'realtime-voice';

	register(
		{ conversation, windows, apps }: RealtimeVoiceIpcDependencies,
		_eventBus: EventBus
	): void {
		const trusted = new ModelRenderer(windows, apps);
		trusted.commandWithEvent(RealtimeVoiceChannels.startSession, (event, request) =>
			conversation.execute({
				type: 'voice',
				action: 'start',
				windowId: windowId(event.sender, apps),
				request,
			})
		);
		trusted.commandWithEvent(RealtimeVoiceChannels.appendAudio, (event, sessionId, audio) =>
			conversation.execute({
				type: 'voice',
				action: 'append-audio',
				windowId: windowId(event.sender, apps),
				sessionId,
				audio,
			})
		);
		trusted.commandWithEvent(RealtimeVoiceChannels.interruptSession, (event, sessionId) =>
			conversation.execute({
				type: 'voice',
				action: 'interrupt',
				windowId: windowId(event.sender, apps),
				sessionId,
			})
		);
		trusted.commandWithEvent(RealtimeVoiceChannels.stopSession, (event, sessionId) =>
			conversation.execute({
				type: 'voice',
				action: 'stop',
				windowId: windowId(event.sender, apps),
				sessionId,
			})
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
