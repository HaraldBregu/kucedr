import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { CodingIpc } from '../../../../src/main/ipc/coding';
import { CodingChannels } from '../../../../src/shared/ipc_channels_definitions';
import type { Coding } from '../../../../src/main/coding';
import type { EventBus } from '../../../../src/main/event_bus';

const windows = { has: jest.fn() };

beforeEach(() => {
	jest.clearAllMocks();
	windows.has.mockReturnValue(true);
});

it('streams Coding app runs back to the originating view and scopes cancellation', async () => {
	const send = jest
		.fn()
		.mockResolvedValue({ projectId: 'project-1', sessionId: 'session-1', output: 'reply' });
	const cancel = jest.fn().mockReturnValue(true);
	const request = { projectId: 'project-1', mode: 'agent', input: 'prompt' } as const;
	const coding = {
		getSettings: jest.fn().mockReturnValue({ runtime: 'pi' }),
		send,
		cancel,
	} as unknown as Coding;
	const appRegistry = {
		has: jest.fn().mockReturnValue(true),
		resolve: jest.fn().mockReturnValue('coder'),
	};
	const sender = {
		id: 23,
		send: jest.fn(),
		once: jest.fn(),
		removeListener: jest.fn(),
	};
	new CodingIpc().register(
		{ coding, appRegistry: appRegistry as never, windows: windows as never },
		{} as EventBus
	);
	const handler = (channel: string) =>
		(ipcMain.handle as jest.Mock).mock.calls.find(([registered]) => registered === channel)?.[1];

	await expect(handler(CodingChannels.getSettings)({ sender })).resolves.toEqual({
		success: true,
		data: { runtime: 'pi' },
	});
	await expect(handler(CodingChannels.send)({ sender }, request, 'run-1')).resolves.toEqual({
		success: true,
		data: { projectId: 'project-1', sessionId: 'session-1', output: 'reply' },
	});
	expect(send).toHaveBeenCalledWith(23, 'run-1', request, expect.any(Function));
	send.mock.calls[0][3]({
		type: 'status',
		runId: 'run-1',
		projectId: 'project-1',
		sessionId: 'session-1',
		status: 'started',
	});
	expect(sender.send).toHaveBeenCalledWith(CodingChannels.response, {
		type: 'status',
		runId: 'run-1',
		projectId: 'project-1',
		sessionId: 'session-1',
		status: 'started',
	});
	expect(sender.once).toHaveBeenCalledWith('destroyed', expect.any(Function));
	expect(sender.removeListener).toHaveBeenCalledWith('destroyed', expect.any(Function));

	await expect(handler(CodingChannels.cancel)({ sender }, 'run-1')).resolves.toEqual({
		success: true,
		data: true,
	});
	expect(cancel).toHaveBeenCalledWith('run-1', 23);
});

it('lets the Coding app select main-owned projects and read their sessions', async () => {
	const selectedProject = {
		id: 'project-1',
		name: 'project',
		directory: '/project',
		kind: 'external',
		createdAt: '2026-08-20T10:00:00.000Z',
		lastOpenedAt: '2026-08-20T10:00:00.000Z',
		available: true,
	};
	const coding = {
		listProjects: jest.fn().mockReturnValue([selectedProject]),
		addProject: jest.fn().mockReturnValue(selectedProject),
		listSessions: jest.fn().mockResolvedValue([]),
		renameSession: jest.fn().mockResolvedValue({ id: 'session-1', title: 'Renamed' }),
		deleteSession: jest.fn().mockResolvedValue(true),
		getProjectInstructions: jest.fn().mockResolvedValue({ projectId: 'project-1' }),
		saveProjectInstructions: jest.fn().mockResolvedValue({ projectId: 'project-1' }),
	} as unknown as Coding;
	const appRegistry = {
		has: jest.fn().mockReturnValue(true),
		resolve: jest.fn().mockReturnValue('coder'),
	};
	const sender = { id: 23 };
	(BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(undefined);
	(dialog.showOpenDialog as jest.Mock).mockResolvedValue({
		canceled: false,
		filePaths: ['/project'],
	});
	new CodingIpc().register(
		{ coding, appRegistry: appRegistry as never, windows: windows as never },
		{} as EventBus
	);
	const handler = (channel: string) =>
		(ipcMain.handle as jest.Mock).mock.calls.find(([registered]) => registered === channel)?.[1];

	await expect(handler(CodingChannels.addProject)({ sender })).resolves.toEqual({
		success: true,
		data: selectedProject,
	});
	expect(coding.addProject).toHaveBeenCalledWith('/project');
	await expect(handler(CodingChannels.listProjects)({ sender })).resolves.toEqual({
		success: true,
		data: [selectedProject],
	});
	await expect(handler(CodingChannels.listSessions)({ sender }, ' project-1 ')).resolves.toEqual({
		success: true,
		data: [],
	});
	expect(coding.listSessions).toHaveBeenCalledWith('project-1');
	await expect(handler(CodingChannels.openProject)({ sender }, ' project-1 ')).resolves.toEqual({
		success: true,
		data: undefined,
	});
	expect(shell.openPath).toHaveBeenCalledWith('/project');
	await expect(
		handler(CodingChannels.renameSession)({ sender }, ' project-1 ', ' session-1 ', ' Renamed ')
	).resolves.toEqual({ success: true, data: { id: 'session-1', title: 'Renamed' } });
	expect(coding.renameSession).toHaveBeenCalledWith('project-1', 'session-1', 'Renamed');
	await expect(
		handler(CodingChannels.deleteSession)({ sender }, ' project-1 ', ' session-1 ')
	).resolves.toEqual({ success: true, data: true });
	expect(coding.deleteSession).toHaveBeenCalledWith('project-1', 'session-1');
	await expect(
		handler(CodingChannels.getProjectInstructions)({ sender }, ' project-1 ')
	).resolves.toEqual({ success: true, data: { projectId: 'project-1' } });
	expect(coding.getProjectInstructions).toHaveBeenCalledWith('project-1');
	const update = { content: '  keep whitespace\n', expectedRevision: 'revision-1' };
	await expect(
		handler(CodingChannels.saveProjectInstructions)({ sender }, ' project-1 ', update)
	).resolves.toEqual({ success: true, data: { projectId: 'project-1' } });
	expect(coding.saveProjectInstructions).toHaveBeenCalledWith('project-1', update);
});

it('restricts project instruction files to the Coding app and validates updates', async () => {
	const coding = {
		getProjectInstructions: jest.fn().mockResolvedValue({ projectId: 'project-1' }),
		saveProjectInstructions: jest.fn().mockResolvedValue({ projectId: 'project-1' }),
	} as unknown as Coding;
	const appRegistry = {
		has: jest.fn().mockReturnValue(true),
		resolve: jest.fn().mockReturnValue('coder'),
	};
	const sender = { id: 23 };
	new CodingIpc().register(
		{ coding, appRegistry: appRegistry as never, windows: windows as never },
		{} as EventBus
	);
	const handler = (channel: string) =>
		(ipcMain.handle as jest.Mock).mock.calls.find(([registered]) => registered === channel)?.[1];

	await expect(
		handler(CodingChannels.saveProjectInstructions)({ sender }, 'project-1', {
			content: 'content',
			expectedRevision: '',
		})
	).resolves.toEqual(expect.objectContaining({ success: false }));
	expect(coding.saveProjectInstructions).not.toHaveBeenCalled();

	appRegistry.has.mockReturnValue(false);
	await expect(
		handler(CodingChannels.getProjectInstructions)({ sender }, 'project-1')
	).resolves.toEqual(
		expect.objectContaining({
			success: false,
			error: expect.objectContaining({
				message: 'Project instructions are only available to the Coding app.',
			}),
		})
	);
	expect(coding.getProjectInstructions).not.toHaveBeenCalled();
});

it('rejects Coding access from other apps', async () => {
	const coding = { getSettings: jest.fn(), send: jest.fn() } as unknown as Coding;
	const appRegistry = {
		has: jest.fn().mockReturnValue(true),
		resolve: jest.fn().mockReturnValue('demo'),
	};
	new CodingIpc().register(
		{ coding, appRegistry: appRegistry as never, windows: windows as never },
		{} as EventBus
	);
	const getSettings = (ipcMain.handle as jest.Mock).mock.calls.find(
		([channel]) => channel === CodingChannels.getSettings
	)?.[1];
	const send = (ipcMain.handle as jest.Mock).mock.calls.find(
		([channel]) => channel === CodingChannels.send
	)?.[1];
	const listModels = (ipcMain.handle as jest.Mock).mock.calls.find(
		([channel]) => channel === CodingChannels.listModels
	)?.[1];
	const sender = { id: 24 };

	await expect(getSettings({ sender })).resolves.toEqual(
		expect.objectContaining({
			success: false,
			error: expect.objectContaining({
				message: 'Coding is only available to the Coding app.',
			}),
		})
	);
	await expect(send({ sender }, 'prompt', 'run-1')).resolves.toEqual(
		expect.objectContaining({ success: false })
	);
	expect(coding.send).not.toHaveBeenCalled();
	await expect(listModels({ sender })).resolves.toEqual(
		expect.objectContaining({ success: false })
	);
});

it('allows configuration and authentication from the host and Coding app only', async () => {
	const connectCodex = jest.fn((_owner, emit) => {
		emit({ type: 'progress', message: 'Waiting' });
		return Promise.resolve({ configured: true, type: 'oauth' });
	});
	const coding = {
		saveSettings: jest.fn((settings) => settings),
		listModels: jest.fn().mockResolvedValue({ providers: [] }),
		connectCodex,
		cancelCodexLogin: jest.fn().mockReturnValue(true),
		disconnectCodex: jest.fn().mockResolvedValue(undefined),
	} as unknown as Coding;
	const appRegistry = { has: jest.fn().mockReturnValue(false) };
	const mainFrame = {};
	const sender = {
		id: 8,
		mainFrame,
		send: jest.fn(),
		once: jest.fn(),
		removeListener: jest.fn(),
	};
	const event = { sender, senderFrame: mainFrame };
	(BrowserWindow.fromWebContents as jest.Mock).mockReturnValue({ id: 1, webContents: sender });
	new CodingIpc().register(
		{ coding, appRegistry: appRegistry as never, windows: windows as never },
		{} as EventBus
	);
	const handler = (channel: string) =>
		(ipcMain.handle as jest.Mock).mock.calls.find(([registered]) => registered === channel)?.[1];

	await expect(handler(CodingChannels.connectCodex)(event)).resolves.toEqual({
		success: true,
		data: { configured: true, type: 'oauth' },
	});
	expect(connectCodex).toHaveBeenCalledWith(8, expect.any(Function));
	expect(sender.send).toHaveBeenCalledWith(CodingChannels.authEvent, {
		type: 'progress',
		message: 'Waiting',
	});
	expect(sender.once).toHaveBeenCalledWith('destroyed', expect.any(Function));
	expect(sender.removeListener).toHaveBeenCalledWith('destroyed', expect.any(Function));

	appRegistry.has.mockReturnValue(true);
	(appRegistry as { resolve?: jest.Mock }).resolve = jest.fn().mockReturnValue('coder');
	await expect(handler(CodingChannels.listModels)(event)).resolves.toEqual({
		success: true,
		data: { providers: [] },
	});
	expect(coding.listModels).toHaveBeenCalled();

	(appRegistry.resolve as jest.Mock).mockReturnValue('demo');
	await expect(handler(CodingChannels.listModels)(event)).resolves.toEqual(
		expect.objectContaining({ success: false })
	);
});
