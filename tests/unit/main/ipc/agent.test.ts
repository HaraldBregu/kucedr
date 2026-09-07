import { BrowserWindow, ipcMain } from 'electron';
import { AgentIpc, normalizeAgentSendRuntimeOptions } from '../../../../src/main/ipc/agent';
import { AgentChannels } from '../../../../src/shared/ipc_channels_definitions';
import type { Agent } from '../../../../src/main/agent/agent';
import type { Conversation } from '../../../../src/main/agent/conversation';
import type { EventBus } from '../../../../src/main/event_bus';
import type { LoggerService } from '../../../../src/main/shared';

describe('AgentIpc run ownership', () => {
	beforeEach(() => {
		(ipcMain.handle as jest.Mock).mockReset();
		(BrowserWindow.fromWebContents as jest.Mock).mockReset();
	});

	it('binds sends and scoped cancellation to the originating window', async () => {
		const execute = jest.fn().mockResolvedValue('reply');
		const cancel = jest.fn().mockReturnValue(true);
		const agent = {
			cancel,
			config: { location: '/agent' },
		} as unknown as Agent;
		const conversation = { execute } as unknown as Conversation;
		const eventBus = { sendTo: jest.fn() } as unknown as EventBus;
		const logger = { info: jest.fn() } as unknown as LoggerService;
		const sender = { mainFrame: {} };
		const event = { sender, senderFrame: sender.mainFrame };
		(BrowserWindow.fromWebContents as jest.Mock).mockReturnValue({ id: 7, webContents: sender });
		new AgentIpc().register(
			{
				logger,
				agent,
				conversation,
				windows: { has: (id: number) => id === 7 } as never,
				apps: { has: () => false } as never,
			},
			eventBus
		);
		const handler = (channel: string) =>
			(ipcMain.handle as jest.Mock).mock.calls.find(([registered]) => registered === channel)?.[1];

		await expect(
			handler(AgentChannels.send)(event, 'hello', {
				runId: 'run-1',
				replyTo: 'Earlier answer',
			})
		).resolves.toEqual({
			success: true,
			data: 'reply',
		});
		expect(execute).toHaveBeenCalledWith({
			type: 'text',
			message: 'hello',
			agentId: 'main',
			options: expect.objectContaining({
				runId: 'run-1',
				type: 'default',
				windowId: 7,
				replyTo: 'Earlier answer',
				streamEvent: expect.any(Function),
			}),
		});
		const streamEvent = execute.mock.calls[0][0].options.streamEvent;
		streamEvent({ type: 'text_delta', delta: 'x', agentId: 'main', runId: 'run-1' });
		expect(eventBus.sendTo).toHaveBeenCalledWith(
			7,
			AgentChannels.response,
			expect.objectContaining({ runId: 'run-1' })
		);

		await expect(handler(AgentChannels.cancel)(event, 'run-1')).resolves.toEqual({
			success: true,
			data: true,
		});
		expect(cancel).toHaveBeenCalledWith('run-1', 7);
	});

	it('rejects cancellation without an originating window', async () => {
		const cancel = jest.fn();
		const agent = { cancel, config: { location: '/agent' } } as unknown as Agent;
		(BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(null);
		new AgentIpc().register(
			{
				logger: { info: jest.fn() } as unknown as LoggerService,
				agent,
				conversation: { execute: jest.fn() } as unknown as Conversation,
				windows: { has: () => false } as never,
				apps: { has: () => false } as never,
			},
			{ sendTo: jest.fn() } as unknown as EventBus
		);
		const cancelHandler = (ipcMain.handle as jest.Mock).mock.calls.find(
			([channel]) => channel === AgentChannels.cancel
		)?.[1];

		const sender = { mainFrame: {} };
		await expect(
			cancelHandler({ sender, senderFrame: sender.mainFrame }, 'run-1')
		).resolves.toMatchObject({ success: false });
		expect(cancel).not.toHaveBeenCalled();
	});

	it('rejects assistant execution and policy changes from app views', async () => {
		const execute = jest.fn();
		const sender = { id: 22, mainFrame: {} };
		const event = { sender, senderFrame: sender.mainFrame };
		(BrowserWindow.fromWebContents as jest.Mock).mockReturnValue({ id: 7, webContents: sender });
		new AgentIpc().register(
			{
				logger: { info: jest.fn() } as unknown as LoggerService,
				agent: { config: { location: '/agent' } } as unknown as Agent,
				conversation: { execute } as unknown as Conversation,
				windows: { has: () => true } as never,
				apps: { has: () => true } as never,
			},
			{ sendTo: jest.fn() } as unknown as EventBus
		);
		const handler = (channel: string) =>
			(ipcMain.handle as jest.Mock).mock.calls.find(([registered]) => registered === channel)?.[1];

		await expect(handler(AgentChannels.send)(event, 'unsafe')).resolves.toMatchObject({
			success: false,
		});
		await expect(
			handler(AgentChannels.policySet)(event, {
				read: { allow: ['*'], deny: [] },
				write: { allow: ['*'], deny: [] },
				exec: { allow: ['*'], deny: [] },
			})
		).resolves.toMatchObject({ success: false });
		expect(execute).not.toHaveBeenCalled();
	});
});

describe('assistant interaction mode normalization', () => {
	it('defaults omitted and invalid values and accepts Plan mode', () => {
		expect(normalizeAgentSendRuntimeOptions(undefined).interactionMode).toBe('default');
		expect(normalizeAgentSendRuntimeOptions({ interactionMode: 'invalid' }).interactionMode).toBe(
			'default'
		);
		expect(normalizeAgentSendRuntimeOptions({ interactionMode: 'plan' }).interactionMode).toBe(
			'plan'
		);
	});
});

it('normalizes reply context and excludes empty or invalid values', () => {
	expect(
		normalizeAgentSendRuntimeOptions({ replyTo: '  Earlier answer\nSecond line  ' })
	).toMatchObject({ replyTo: 'Earlier answer\nSecond line' });
	for (const replyTo of ['', ' \n ', 42, {}, null]) {
		expect(normalizeAgentSendRuntimeOptions({ replyTo })).not.toHaveProperty('replyTo');
	}
});
