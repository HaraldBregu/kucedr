const mockStream = jest.fn();
const mockAdapterStart = jest.fn();
const mockAdapterStop = jest.fn();
const mockAdapterSend = jest.fn();
const mockAdapterOnMessage = jest.fn();
const mockAdapterOnStatus = jest.fn();
let mockInboundHandler: ((message: unknown) => void) | undefined;

jest.mock('../../src/main/shared/agent_location', () => ({
	agentLocation: () => '/tmp/kucedr-agent-integration',
}));
jest.mock('../../src/main/tasks', () => ({
	initTask: jest.fn(),
	destroyTask: jest.fn(),
	getRuntime: jest.fn(),
	setTaskRunner: jest.fn(),
	startTask: jest.fn(),
}));
jest.mock('../../src/main/agent/health', () => ({
	startHealth: jest.fn(),
	stopHealth: jest.fn(),
}));
jest.mock('../../src/main/agent/permissions', () => ({
	getPermissions: () => ({ mode: 'ask', dir: {} }),
	rejectPendingToolPermissions: jest.fn(),
}));
jest.mock('../../src/main/agent/skills', () => ({
	parseSkillCommand: (message: string) => ({ message }),
}));
jest.mock('../../src/main/agent/session', () => ({
	createSessionState: () => ({
		id: '',
		category: 'main',
		messages: [],
		toolCalls: [],
		usage: { inputTokens: 0, outputTokens: 0 },
		maxTurns: 20,
		model: 'default',
		numTurns: 0,
		finalText: '',
		sessionsPath: '',
		folderName: '',
		runTraceBuffer: [],
		runContext: {
			loadedSkills: [],
			fileAccess: { readDirectories: new Set(), createdFiles: new Set() },
		},
	}),
	init: (state: { id: string }, _config: unknown, input: { sessionId: string }) => {
		state.id = input.sessionId;
	},
	listSessions: jest.fn(() => []),
	loadMessages: jest.fn(() => []),
	resolveSessionId: (sessionId: string | undefined, _location: string, category: string) =>
		sessionId ?? `${category}-session`,
	resolveStoredSessionId: (sessionId: string) => sessionId,
	tryAppendRun: jest.fn(),
}));
jest.mock('../../src/main/agent/runner/run_stream', () => ({
	stream: (...args: unknown[]) => mockStream(...args),
}));
jest.mock('../../src/main/channels/channels_store', () => ({
	getChannelProvider: () => ({
		id: 'telegram',
		name: 'Telegram',
		baseUrl: '',
		apiKey: 'token',
		dmPolicy: 'open',
	}),
	getChannelModelSelection: () => ({}),
	getChannelPermissions: () => ({ mode: 'ask', dir: {} }),
}));
jest.mock('../../src/main/channels/adapters/telegram', () => ({
	createTelegramAdapter: () => ({
		start: mockAdapterStart,
		stop: mockAdapterStop,
		send: mockAdapterSend,
		onMessage: mockAdapterOnMessage,
		onStatus: mockAdapterOnStatus,
	}),
}));
jest.mock('../../src/main/models/transcribe', () => ({ toText: jest.fn() }));
jest.mock('../../src/main/models/voice', () => ({ synthesize: jest.fn() }));

import { BrowserWindow, ipcMain } from 'electron';
import { Agent } from '../../src/main/agent/agent';
import { AgentIpc } from '../../src/main/ipc/agent';
import { createChannelRegistry } from '../../src/main/channels/channels_registry';
import { AgentChannels } from '../../src/shared/ipc_channels_definitions';
import type { EventBus } from '../../src/main/event_bus';
import type { LoggerService } from '../../src/main/shared';
import type { WindowFactory } from '../../src/main/window_factory';
import type { ExecSandbox } from '../../src/main/agent/sandbox';
import type { Conversation } from '../../src/main/agent/conversation';

function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve = () => {};
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

it('cancels the IPC UI run without interrupting the channel registry bot run', async () => {
	const uiStarted = deferred();
	const botStarted = deferred();
	const botRelease = deferred();
	const replySent = deferred();
	mockStream.mockImplementation(
		(
			_config: unknown,
			_session: unknown,
			input: { runId: string; agentId: string; sessionId: string },
			signal: AbortSignal
		) =>
			(async function* () {
				if (input.runId === 'ui-run') {
					uiStarted.resolve();
					await new Promise<void>((resolve) => {
						if (signal.aborted) resolve();
						else signal.addEventListener('abort', () => resolve(), { once: true });
					});
					return;
				}
				botStarted.resolve();
				await botRelease.promise;
				yield {
					type: 'run_finished',
					result: {
						text: 'bot reply',
						model: 'model',
						toolCalls: [],
						numTurns: 1,
						subtype: 'success',
						sessionId: input.sessionId,
						stopReason: 'end_turn',
					},
				};
			})()
	);
	(ipcMain.handle as jest.Mock).mockReset();
	mockAdapterStart.mockResolvedValue(undefined);
	mockAdapterStop.mockResolvedValue(undefined);
	mockAdapterSend.mockImplementation(async () => {
		replySent.resolve();
		return {
			channel: 'telegram',
			to: 'chat-1',
			status: 'sent',
			platformMessageIds: ['reply-1'],
			parts: [],
			sentAt: 0,
		};
	});
	mockAdapterOnMessage.mockImplementation((handler) => {
		mockInboundHandler = handler;
		return jest.fn();
	});
	mockAdapterOnStatus.mockReturnValue(jest.fn());
	const uiSender = { mainFrame: {} };
	const otherSender = { mainFrame: {} };
	(BrowserWindow.fromWebContents as jest.Mock).mockImplementation((sender) =>
		sender === uiSender
			? { id: 1, webContents: uiSender }
			: sender === otherSender
				? { id: 2, webContents: otherSender }
				: null
	);
	const logger = {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	} as unknown as LoggerService;
	const eventBus = {
		sendTo: jest.fn(),
		emit: jest.fn(),
		broadcast: jest.fn(),
	} as unknown as EventBus;
	const agent = new Agent({ reset: jest.fn() } as unknown as ExecSandbox);
	const conversation = {
		execute: ({ message, options }: { message: string; options: unknown }) =>
			agent.send(message, 'main', options as never),
	} as unknown as Conversation;
	new AgentIpc().register(
		{
			logger,
			agent,
			conversation,
			windows: { has: (id: number) => id === 1 || id === 2 } as never,
			apps: { has: () => false } as never,
		},
		eventBus
	);
	const registry = createChannelRegistry({ logger, eventBus, agentService: agent });
	await registry.start('telegram');
	const handler = (channel: string) =>
		(ipcMain.handle as jest.Mock).mock.calls.find(([registered]) => registered === channel)?.[1];
	const uiResponse = handler(AgentChannels.send)(
		{ sender: uiSender, senderFrame: uiSender.mainFrame },
		'ui request',
		{
			runId: 'ui-run',
			sessionId: 'ui-session',
		}
	);
	mockInboundHandler?.({
		channel: 'telegram',
		accountId: 'account-1',
		senderId: 'sender-1',
		chatId: 'chat-1',
		chatType: 'dm',
		messageId: 'message-1',
		threadId: 'thread-1',
		content: { type: 'text', text: 'bot request' },
		idempotencyKey: 'message-1',
		receivedAt: 0,
	});
	await Promise.all([uiStarted.promise, botStarted.promise]);

	await expect(
		handler(AgentChannels.cancel)(
			{ sender: otherSender, senderFrame: otherSender.mainFrame },
			'ui-run'
		)
	).resolves.toEqual({ success: true, data: false });
	await expect(
		handler(AgentChannels.cancel)({ sender: uiSender, senderFrame: uiSender.mainFrame }, 'ui-run')
	).resolves.toEqual({ success: true, data: true });
	botRelease.resolve();
	await replySent.promise;
	await expect(uiResponse).resolves.toEqual({ success: true, data: '' });
	expect(mockAdapterSend).toHaveBeenCalledWith(
		expect.objectContaining({ content: { type: 'text', text: 'bot reply' } })
	);

	await registry.destroy();
	agent.cancelAll();
});
