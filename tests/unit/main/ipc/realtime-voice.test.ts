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

function voiceManager() {
	return {
		start: jest.fn(async () => undefined),
		appendAudio: jest.fn(async () => undefined),
		interrupt: jest.fn(async () => undefined),
		stop: jest.fn(async () => undefined),
	};
}

beforeEach(() => {
	jest.clearAllMocks();
	(openAppWindows as Map<string, unknown>).clear();
});

it('routes realtime voice lifecycle commands through the invoking window owner', async () => {
	const voice = voiceManager();
	const mainFrame = {};
	const sender = { mainFrame };
	const dependencies = {
		voice: voice as never,
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

	expect(voice.start).toHaveBeenCalledWith(42, { chatSessionId: 'chat' });
	expect(voice.appendAudio).toHaveBeenCalledWith(42, 'voice', 'AAAA');
	expect(voice.interrupt).toHaveBeenCalledWith(42, 'voice');
	expect(voice.stop).toHaveBeenCalledWith(42, 'voice');
});

it('routes registered app views through their containing app window', async () => {
	const voice = voiceManager();
	const mainFrame = {};
	const sender = { mainFrame };
	const appWindow = { id: 84, isDestroyed: () => false };
	(openAppWindows as Map<string, unknown>).set('demo', { window: appWindow });
	const dependencies = {
		voice: voice as never,
		windows: { has: () => false } as never,
		apps: {
			has: () => true,
			resolve: () => 'demo',
		} as never,
	};
	new RealtimeVoiceIpc().register(dependencies, {} as never);
	const event = { sender, senderFrame: mainFrame };

	await command(RealtimeVoiceChannels.startSession)(event, { chatSessionId: 'chat' });

	expect(voice.start).toHaveBeenCalledWith(84, { chatSessionId: 'chat' });
});
