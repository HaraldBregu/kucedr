const registerCommandWithEvent = jest.fn();

jest.mock('../../../../src/main/ipc/core/gateway', () => ({ registerCommandWithEvent }));
jest.mock('../../../../src/main/apps/app_render', () => ({ openAppWindows: new Map() }));

import { BrowserWindow } from 'electron';
import { RealtimeVoiceIpc } from '../../../../src/main/ipc/realtime_voice';
import { RealtimeVoiceChannels } from '../../../../src/shared/ipc_channels_definitions';
import { openAppWindows } from '../../../../src/main/apps/app_render';

function command(channel: string): (...args: unknown[]) => unknown {
	return registerCommandWithEvent.mock.calls.find(([registered]) => registered === channel)?.[1];
}

it('routes realtime voice lifecycle commands through the invoking window owner', async () => {
	const execute = jest.fn(async () => undefined);
	const mainFrame = {};
	const sender = { mainFrame };
	const dependencies = {
		conversation: { execute } as never,
		windows: { has: () => true } as never,
		apps: { has: () => false } as never,
	};
	jest
		.mocked(BrowserWindow.fromWebContents)
		.mockReturnValue({ id: 42, webContents: sender, isDestroyed: () => false } as never);
	new RealtimeVoiceIpc().register(dependencies, {} as never);
	const event = { sender, senderFrame: mainFrame };

	await command(RealtimeVoiceChannels.startSession)(event, { chatSessionId: 'chat' });
	await command(RealtimeVoiceChannels.appendAudio)(event, 'voice', 'AAAA');
	await command(RealtimeVoiceChannels.interruptSession)(event, 'voice');
	await command(RealtimeVoiceChannels.stopSession)(event, 'voice');

	expect(execute).toHaveBeenNthCalledWith(1, {
		type: 'voice',
		action: 'start',
		windowId: 42,
		request: { chatSessionId: 'chat' },
	});
	expect(execute).toHaveBeenNthCalledWith(2, {
		type: 'voice',
		action: 'append-audio',
		windowId: 42,
		sessionId: 'voice',
		audio: 'AAAA',
	});
	expect(execute).toHaveBeenNthCalledWith(3, {
		type: 'voice',
		action: 'interrupt',
		windowId: 42,
		sessionId: 'voice',
	});
	expect(execute).toHaveBeenNthCalledWith(4, {
		type: 'voice',
		action: 'stop',
		windowId: 42,
		sessionId: 'voice',
	});
});

it('routes registered app views through their containing app window', async () => {
	const execute = jest.fn(async () => undefined);
	const mainFrame = {};
	const sender = { mainFrame };
	const appWindow = { id: 84, isDestroyed: () => false };
	(openAppWindows as Map<string, unknown>).set('demo', { window: appWindow });
	const dependencies = {
		conversation: { execute } as never,
		windows: { has: () => false } as never,
		apps: {
			has: () => true,
			resolve: () => 'demo',
		} as never,
	};
	new RealtimeVoiceIpc().register(dependencies, {} as never);
	const event = { sender, senderFrame: mainFrame };

	await command(RealtimeVoiceChannels.startSession)(event, { chatSessionId: 'chat' });

	expect(execute).toHaveBeenCalledWith({
		type: 'voice',
		action: 'start',
		windowId: 84,
		request: { chatSessionId: 'chat' },
	});
	(openAppWindows as Map<string, unknown>).clear();
});
