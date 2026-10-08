import { BrowserWindow, ipcMain } from 'electron';
import { AgentIpc, normalizeAgentSendRuntimeOptions } from '../../../../src/main/ipc/agent';
import { AgentChannels } from '../../../../src/shared/ipc_channels_definitions';
import type { Agent } from '../../../../src/main/agent/agent';
import type { Conversation } from '../../../../src/main/agent/conversation';
import type { EventBus } from '../../../../src/main/event_bus';
import type { LoggerService } from '../../../../src/main/shared';
import * as permissionsApi from '../../../../src/main/agent/permissions';
import * as ragStore from '../../../../src/main/agent/knowledge/rag/rag_store';
import * as ragRun from '../../../../src/main/agent/knowledge/rag/run';
import * as ragStatus from '../../../../src/main/agent/knowledge/rag/status';
import * as ragCancel from '../../../../src/main/agent/knowledge/rag/cancel';
import * as ragDisclosure from '../../../../src/main/agent/knowledge/rag/disclosure';

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

	it('routes policy reads, writes, and resets to Voice while preserving the Chat default', async () => {
		const policy = {
			read: { allow: ['/voice/**'], deny: [] },
			write: { allow: [], deny: [] },
			exec: { allow: [], deny: [] },
		};
		const get = jest.spyOn(permissionsApi, 'getPermissions').mockReturnValue(policy);
		const set = jest.spyOn(permissionsApi, 'setPermissions').mockReturnValue(policy);
		const reset = jest.spyOn(permissionsApi, 'resetPermissions').mockReturnValue(policy);
		const invalidate = jest.fn().mockResolvedValue(undefined);
		const sender = { mainFrame: {} };
		const event = { sender, senderFrame: sender.mainFrame };
		(BrowserWindow.fromWebContents as jest.Mock).mockReturnValue({ id: 7, webContents: sender });
		new AgentIpc().register(
			{
				logger: { info: jest.fn() } as unknown as LoggerService,
				agent: { config: { location: '/agent' }, sandbox: { invalidate } } as unknown as Agent,
				conversation: { execute: jest.fn() } as unknown as Conversation,
				windows: { has: (id: number) => id === 7 } as never,
				apps: { has: () => false } as never,
			},
			{ sendTo: jest.fn() } as unknown as EventBus
		);
		const handler = (channel: string) =>
			(ipcMain.handle as jest.Mock).mock.calls.find(([registered]) => registered === channel)?.[1];
		try {
			await expect(handler(AgentChannels.policyGet)(event, 'voice')).resolves.toEqual({
				success: true,
				data: policy,
			});
			expect(get).toHaveBeenLastCalledWith('voice');
			await expect(handler(AgentChannels.policySet)(event, policy, 'voice')).resolves.toEqual({
				success: true,
				data: policy,
			});
			expect(set).toHaveBeenLastCalledWith(policy, 'voice');
			await expect(handler(AgentChannels.policyReset)(event, 'voice')).resolves.toEqual({
				success: true,
				data: policy,
			});
			expect(reset).toHaveBeenLastCalledWith('voice');
			await handler(AgentChannels.policyGet)(event);
			expect(get).toHaveBeenLastCalledWith('chat');
			await handler(AgentChannels.policySet)(event, policy);
			expect(set).toHaveBeenLastCalledWith(policy, 'chat');
			await handler(AgentChannels.policyReset)(event);
			expect(reset).toHaveBeenLastCalledWith('chat');
			await expect(
				handler(AgentChannels.policySet)(event, policy, 'unknown')
			).resolves.toMatchObject({ success: false });
			expect(set).toHaveBeenCalledTimes(2);
		} finally {
			get.mockRestore();
			set.mockRestore();
			reset.mockRestore();
		}
	});

	it('lists every session type when requested', async () => {
		const listSessions = jest.fn().mockReturnValue([]);
		const agent = { listSessions, config: { location: '/agent' } } as unknown as Agent;
		const sender = { mainFrame: {} };
		const event = { sender, senderFrame: sender.mainFrame };
		(BrowserWindow.fromWebContents as jest.Mock).mockReturnValue({ id: 7, webContents: sender });
		new AgentIpc().register(
			{
				logger: { info: jest.fn() } as unknown as LoggerService,
				agent,
				conversation: { execute: jest.fn() } as unknown as Conversation,
				windows: { has: (id: number) => id === 7 } as never,
				apps: { has: () => false } as never,
			},
			{ sendTo: jest.fn() } as unknown as EventBus
		);
		const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
			([channel]) => channel === AgentChannels.listSessions
		)?.[1];

		await expect(handler(event, true)).resolves.toEqual({ success: true, data: [] });
		expect(listSessions).toHaveBeenCalledWith('all');
	});

	it('validates and forwards compact-session requests', async () => {
		const compactSession = jest.fn().mockResolvedValue({
			status: 'compacted',
			retainedMessages: 9,
			removedMessages: 12,
		});
		const agent = { compactSession, config: { location: '/agent' } } as unknown as Agent;
		const sender = { mainFrame: {} };
		const event = { sender, senderFrame: sender.mainFrame };
		(BrowserWindow.fromWebContents as jest.Mock).mockReturnValue({ id: 7, webContents: sender });
		new AgentIpc().register(
			{
				logger: { info: jest.fn() } as unknown as LoggerService,
				agent,
				conversation: { execute: jest.fn() } as unknown as Conversation,
				windows: { has: (id: number) => id === 7 } as never,
				apps: { has: () => false } as never,
			},
			{ sendTo: jest.fn() } as unknown as EventBus
		);
		const handler = (ipcMain.handle as jest.Mock).mock.calls.find(
			([channel]) => channel === AgentChannels.compactSession
		)?.[1];

		await expect(handler(event, '11111111-1111-4111-8111-111111111111')).resolves.toEqual({
			success: true,
			data: { status: 'compacted', retainedMessages: 9, removedMessages: 12 },
		});
		expect(compactSession).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
		await expect(handler(event, 'not-a-session')).resolves.toMatchObject({ success: false });
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

	it('saves Knowledge selections atomically and routes indexing, status, and cancellation through its coordinator', async () => {
		const configuration = {
			...ragStore.getRagConfiguration(),
			databaseProviderId: 'local',
			databaseId: 'sqlite',
			embeddingProviderId: 'voyage',
			embeddingModelId: 'voyage-4-large',
		};
		const saved = jest.spyOn(ragStore, 'saveRagConfiguration').mockReturnValue(configuration);
		const authorize = jest.spyOn(ragDisclosure, 'authorizeRagDisclosure').mockImplementation((input) => input);
		const run = jest.spyOn(ragRun, 'runRagIndexing').mockResolvedValue({ files: 1, vectors: 2 });
		const status = jest.spyOn(ragStatus, 'getRagStatus').mockReturnValue({ running: true, outcome: 'running' } as never);
		const cancel = jest.spyOn(ragCancel, 'cancelRagIndexing').mockImplementation(() => undefined);
		const sender = { mainFrame: {} };
		const event = { sender, senderFrame: sender.mainFrame };
		(BrowserWindow.fromWebContents as jest.Mock).mockReturnValue({ id: 7, webContents: sender });
		new AgentIpc().register(
			{
				logger: { info: jest.fn() } as unknown as LoggerService,
				agent: { config: { location: '/agent' } } as unknown as Agent,
				conversation: { execute: jest.fn() } as unknown as Conversation,
				windows: { has: (id: number) => id === 7 } as never,
				apps: { has: () => false } as never,
			},
			{ sendTo: jest.fn() } as unknown as EventBus
		);
		const handler = (channel: string) =>
			(ipcMain.handle as jest.Mock).mock.calls.find(([registered]) => registered === channel)?.[1];
		try {
			await expect(handler(AgentChannels.ragSaveConfiguration)(event, configuration)).resolves.toEqual({ success: true, data: configuration });
			expect(saved).toHaveBeenCalledWith(configuration);
			expect(authorize).toHaveBeenCalledWith(configuration);
			await expect(handler(AgentChannels.ragIndex)(event)).resolves.toEqual({ success: true, data: { files: 1, vectors: 2 } });
			expect(run).toHaveBeenCalledWith();
			await expect(handler(AgentChannels.ragGetStatus)(event)).resolves.toMatchObject({ success: true, data: { running: true } });
			await expect(handler(AgentChannels.ragCancelIndex)(event)).resolves.toEqual({ success: true, data: undefined });
			expect(cancel).toHaveBeenCalledTimes(1);
		} finally {
			saved.mockRestore();
			authorize.mockRestore();
			run.mockRestore();
			status.mockRestore();
			cancel.mockRestore();
		}
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

it('allows a resubmission to reuse the edited user message', () => {
	expect(normalizeAgentSendRuntimeOptions({ reuseLastUserMessage: true })).toMatchObject({
		reuseLastUserMessage: true,
	});
	expect(normalizeAgentSendRuntimeOptions({ reuseLastUserMessage: 'true' })).not.toHaveProperty(
		'reuseLastUserMessage'
	);
});
