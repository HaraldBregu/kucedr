import type { IpcModule } from './core/module';
import type { EventBus } from '../event_bus';
import { registerCommandWithEvent } from './core/gateway';
import { RecorderChannels } from '../../shared/ipc_channels_definitions';
import { camera, microphone, screen } from '../recorder';
import type { AppRegistry } from '../apps/app_registry';
import type { WindowContextManager } from '../window_context';
import { TrustedRenderer } from './core/trusted';

export interface RecorderIpcDeps {
	windows: WindowContextManager;
	apps: AppRegistry;
}

export class RecorderIpc implements IpcModule<RecorderIpcDeps> {
	readonly name = 'recorder';

	register({ windows, apps }: RecorderIpcDeps, _eventBus: EventBus): void {
		const trusted = new TrustedRenderer(windows, apps);
		registerCommandWithEvent(RecorderChannels.microphone.complete, (event, result) => {
			trusted.assert(event);
			return microphone.complete(result, event.sender.id);
		});
		registerCommandWithEvent(RecorderChannels.microphone.chunk, (event, chunk) => {
			trusted.assert(event);
			return microphone.chunk(chunk, event.sender.id);
		});
		registerCommandWithEvent(RecorderChannels.camera.complete, (event, result) => {
			trusted.assert(event);
			return camera.complete(result, event.sender.id);
		});
		registerCommandWithEvent(RecorderChannels.camera.chunk, (event, chunk) => {
			trusted.assert(event);
			return camera.chunk(chunk, event.sender.id);
		});
		registerCommandWithEvent(RecorderChannels.screen.complete, (event, result) => {
			trusted.assert(event);
			return screen.complete(result, event.sender.id);
		});
		registerCommandWithEvent(RecorderChannels.screen.chunk, (event, chunk) => {
			trusted.assert(event);
			return screen.chunk(chunk, event.sender.id);
		});
	}
}
