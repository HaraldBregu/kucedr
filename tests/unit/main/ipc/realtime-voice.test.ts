const registerCommandWithEvent = jest.fn();

jest.mock('../../../../src/main/ipc/core/gateway', () => ({ registerCommandWithEvent }));

import { BrowserWindow } from 'electron';
import { RealtimeVoiceIpc } from '../../../../src/main/ipc/realtime_voice';
import { RealtimeVoiceChannels } from '../../../../src/shared/ipc_channels_definitions';

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

it('rejects realtime voice commands from app views', () => {
	const voice = voiceManager();
	const mainFrame = {};
	const sender = { mainFrame };
	const dependencies = {
		voice: voice as never,
		windows: { has: () => false } as never,
		apps: { has: () => true } as never,
	};
	new RealtimeVoiceIpc().register(dependencies, {} as never);
	const event = { sender, senderFrame: mainFrame };

	expect(() =>
		command(RealtimeVoiceChannels.startSession)(event, { chatSessionId: 'chat' })
	).toThrow('Privileged IPC is unavailable to app views.');
	expect(voice.start).not.toHaveBeenCalled();
});
