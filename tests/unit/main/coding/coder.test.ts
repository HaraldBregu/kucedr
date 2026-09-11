jest.mock('../../../../src/main/coding/location', () => ({
	codingLocation: () => '/tmp/kucedr-coding-test',
	codingSessionsLocation: () => '/tmp/kucedr-coding-test/sessions',
}));

import {
	createAgentSession,
	DefaultResourceLoader,
	modelRuntimeCreate,
	sessionManagerCreate,
	sessionManagerList,
	sessionManagerOpen,
} from '@earendil-works/pi-coding-agent';
import { Coder } from '../../../../src/main/coding/coding';
import type { CodingProjectStore } from '../../../../src/main/coding/projects';
import type { CodingStore } from '../../../../src/main/coding/store';

const settings = {
	runtime: 'pi' as const,
	providerId: 'openai' as const,
	modelId: 'gpt-coding',
	thinkingLevel: 'medium' as const,
	toolMode: 'read-only' as const,
};

const project = {
	id: 'project-1',
	name: 'Kucedr',
	directory: process.cwd(),
	kind: 'external' as const,
	createdAt: '2026-08-20T10:00:00.000Z',
	lastOpenedAt: '2026-08-20T10:00:00.000Z',
	available: true,
};

const projects = {
	list: jest.fn(() => [project]),
	get: jest.fn((projectId: string) => (projectId === project.id ? project : undefined)),
	add: jest.fn(),
	remove: jest.fn(),
	touch: jest.fn(),
};

beforeEach(() => {
	jest.clearAllMocks();
	DefaultResourceLoader.instances.length = 0;
	sessionManagerCreate.mockReturnValue({ getSessionId: () => 'session-1' });
});

it('runs Pi with the saved model, isolated resources, and redacted stream events', async () => {
	const model = {
		id: 'gpt-coding',
		name: 'GPT Coder',
		reasoning: true,
		contextWindow: 1000,
	};
	const runtime = {
		getModel: jest.fn(() => model),
		checkAuth: jest.fn(async () => ({ type: 'api_key', source: 'Kucedr' })),
		setRuntimeApiKey: jest.fn(async () => undefined),
		removeRuntimeApiKey: jest.fn(async () => undefined),
	};
	modelRuntimeCreate.mockResolvedValue(runtime);
	let listener: (event: unknown) => void = () => undefined;
	const session = {
		subscribe: jest.fn((nextListener) => {
			listener = nextListener;
			return jest.fn();
		}),
		prompt: jest.fn(async () => {
			listener({
				type: 'message_update',
				assistantMessageEvent: { type: 'text_delta', delta: 'done' },
			});
			listener({
				type: 'tool_execution_start',
				toolCallId: 'tool-1',
				toolName: 'read',
				args: { path: '/secret/path' },
			});
			listener({
				type: 'tool_execution_end',
				toolCallId: 'tool-1',
				toolName: 'read',
				result: { content: 'secret output' },
				isError: false,
			});
		}),
		executeBash: jest.fn(),
		abortBash: jest.fn(),
		abort: jest.fn(async () => undefined),
		dispose: jest.fn(),
	};
	(createAgentSession as jest.Mock).mockResolvedValue({ session });
	const coding = new Coder({
		store: { get: jest.fn(() => settings), set: jest.fn() } as unknown as CodingStore,
		projects: projects as unknown as CodingProjectStore,
		getProvider: (id) =>
			id === 'openai'
				? { id, name: 'OpenAI', apiKey: 'key', baseUrl: 'https://api.openai.com/v1' }
				: undefined,
	});
	const events: unknown[] = [];

	await expect(
		coding.send(
			4,
			'run-1',
			{ projectId: project.id, mode: 'agent', input: 'Inspect this project' },
			(event) => events.push(event)
		)
	).resolves.toEqual({ projectId: project.id, sessionId: 'session-1', output: 'done' });
	expect(sessionManagerCreate).toHaveBeenCalledWith(
		project.directory,
		'/tmp/kucedr-coding-test/sessions'
	);
	expect(createAgentSession).toHaveBeenCalledWith(
		expect.objectContaining({
			model,
			tools: ['read', 'grep', 'find', 'ls'],
		})
	);
	expect(DefaultResourceLoader.instances[0]?.options).toEqual(
		expect.objectContaining({
			noExtensions: true,
			noSkills: true,
			noPromptTemplates: true,
			noThemes: true,
		})
	);
	expect(events).toContainEqual({
		type: 'text-delta',
		runId: 'run-1',
		projectId: project.id,
		sessionId: 'session-1',
		delta: 'done',
	});
	expect(events).toContainEqual({
		type: 'tool-start',
		runId: 'run-1',
		projectId: project.id,
		sessionId: 'session-1',
		toolCallId: 'tool-1',
		toolName: 'read',
	});
	expect(JSON.stringify(events)).not.toContain('secret');
});

it('reloads cwd-bound instructions before the next message in a resumed session', async () => {
	const model = { id: 'gpt-coding' };
	modelRuntimeCreate.mockResolvedValue({
		getModel: jest.fn(() => model),
		checkAuth: jest.fn(async () => ({ type: 'api_key' })),
		setRuntimeApiKey: jest.fn(async () => undefined),
		removeRuntimeApiKey: jest.fn(async () => undefined),
	});
	const session = {
		subscribe: jest.fn(() => jest.fn()),
		prompt: jest.fn(async () => undefined),
		executeBash: jest.fn(),
		abortBash: jest.fn(),
		abort: jest.fn(async () => undefined),
		dispose: jest.fn(),
	};
	(createAgentSession as jest.Mock).mockResolvedValue({ session });
	const sessionInfo = {
		id: 'session-1',
		path: '/tmp/kucedr-coding-test/sessions/session-1.jsonl',
		cwd: project.directory,
		name: undefined,
		created: new Date('2026-08-20T10:00:00.000Z'),
		modified: new Date('2026-08-20T10:01:00.000Z'),
		messageCount: 1,
		firstMessage: 'First message',
	};
	const reopenedManager = { getSessionId: () => sessionInfo.id };
	sessionManagerList.mockResolvedValue([sessionInfo]);
	sessionManagerOpen.mockReturnValue(reopenedManager);
	const coding = new Coder({
		store: { get: jest.fn(() => settings), set: jest.fn() } as unknown as CodingStore,
		projects: projects as unknown as CodingProjectStore,
		getProvider: (id) => ({ id, name: id, apiKey: 'key', baseUrl: '' }),
	});

	await coding.send(
		4,
		'run-first',
		{ projectId: project.id, mode: 'agent', input: 'First message' },
		() => undefined
	);
	await coding.send(
		4,
		'run-second',
		{ projectId: project.id, sessionId: sessionInfo.id, mode: 'agent', input: 'Next message' },
		() => undefined
	);

	expect(DefaultResourceLoader.instances).toHaveLength(2);
	expect(DefaultResourceLoader.instances[0]).not.toBe(DefaultResourceLoader.instances[1]);
	for (const loader of DefaultResourceLoader.instances) {
		expect(loader.options).toEqual(expect.objectContaining({ cwd: project.directory }));
		expect(loader.reload).toHaveBeenCalledTimes(1);
	}
	expect(createAgentSession).toHaveBeenNthCalledWith(
		1,
		expect.objectContaining({ resourceLoader: DefaultResourceLoader.instances[0] })
	);
	expect(createAgentSession).toHaveBeenNthCalledWith(
		2,
		expect.objectContaining({
			resourceLoader: DefaultResourceLoader.instances[1],
			sessionManager: reopenedManager,
		})
	);
});

it('rejects instruction access for an unavailable stored project', async () => {
	projects.get.mockReturnValueOnce({ ...project, available: false });
	const coding = new Coder({
		store: { get: jest.fn(() => settings), set: jest.fn() } as unknown as CodingStore,
		projects: projects as unknown as CodingProjectStore,
		getProvider: () => undefined,
	});

	await expect(coding.getProjectInstructions(project.id)).rejects.toThrow(
		'Coder project directory is unavailable.'
	);
});

it('reopens a project session and records streamed Shell output', async () => {
	const sessionInfo = {
		id: 'session-1',
		path: '/tmp/kucedr-coding-test/sessions/session-1.jsonl',
		cwd: project.directory,
		name: undefined,
		created: new Date('2026-08-20T10:00:00.000Z'),
		modified: new Date('2026-08-20T10:01:00.000Z'),
		messageCount: 2,
		firstMessage: 'Inspect this project',
	};
	const manager = { getSessionId: () => sessionInfo.id };
	sessionManagerList.mockResolvedValue([sessionInfo]);
	sessionManagerOpen.mockReturnValue(manager);
	modelRuntimeCreate.mockResolvedValue({
		getModel: jest.fn(() => ({ id: 'gpt-coding' })),
		checkAuth: jest.fn(async () => ({ type: 'api_key' })),
		setRuntimeApiKey: jest.fn(async () => undefined),
		removeRuntimeApiKey: jest.fn(async () => undefined),
	});
	const session = {
		subscribe: jest.fn(() => jest.fn()),
		prompt: jest.fn(),
		executeBash: jest.fn(async (_command, onChunk) => {
			onChunk('file-a\n');
			return { exitCode: 0, cancelled: false, truncated: false };
		}),
		abortBash: jest.fn(),
		abort: jest.fn(async () => undefined),
		dispose: jest.fn(),
	};
	(createAgentSession as jest.Mock).mockResolvedValue({ session });
	const coding = new Coder({
		store: { get: jest.fn(() => settings), set: jest.fn() } as unknown as CodingStore,
		projects: projects as unknown as CodingProjectStore,
		getProvider: (id) => ({ id, name: id, apiKey: 'key', baseUrl: '' }),
	});
	const events: unknown[] = [];

	await expect(
		coding.send(
			4,
			'run-shell',
			{ projectId: project.id, sessionId: sessionInfo.id, mode: 'shell', input: 'ls' },
			(event) => events.push(event)
		)
	).resolves.toEqual({ projectId: project.id, sessionId: sessionInfo.id, output: 'file-a\n' });
	expect(sessionManagerOpen).toHaveBeenCalledWith(
		sessionInfo.path,
		'/tmp/kucedr-coding-test/sessions',
		project.directory
	);
	expect(session.executeBash).toHaveBeenCalledWith('ls', expect.any(Function));
	expect(events).toContainEqual({
		type: 'command-end',
		runId: 'run-shell',
		projectId: project.id,
		sessionId: sessionInfo.id,
		exitCode: 0,
		cancelled: false,
		truncated: false,
	});
});

it('uses Codex device OAuth and projects only the device code event', async () => {
	const runtime = {
		login: jest.fn(async (_provider, _type, interaction) => {
			await expect(
				interaction.prompt({
					type: 'select',
					message: 'Choose login',
					options: [{ id: 'device_code', label: 'Device code' }],
				})
			).resolves.toBe('device_code');
			interaction.notify({
				type: 'device_code',
				userCode: 'ABCD-EFGH',
				verificationUri: 'https://example.com/device',
				expiresInSeconds: 600,
			});
		}),
		checkAuth: jest.fn(async () => ({ type: 'oauth', source: 'OAuth' })),
	};
	modelRuntimeCreate.mockResolvedValue(runtime);
	const coding = new Coder({
		store: { get: jest.fn(() => settings), set: jest.fn() } as unknown as CodingStore,
		projects: projects as unknown as CodingProjectStore,
		getProvider: () => undefined,
	});
	const events: unknown[] = [];

	await expect(coding.connectCodex(4, (event) => events.push(event))).resolves.toEqual({
		configured: true,
		type: 'oauth',
		source: 'OAuth',
	});
	expect(events).toEqual([
		{
			type: 'device-code',
			userCode: 'ABCD-EFGH',
			verificationUri: 'https://example.com/device',
			expiresInSeconds: 600,
		},
	]);
});

it('renames only a session resolved inside its project', async () => {
	const appendSessionInfo = jest.fn();
	const original = {
		id: 'session-1',
		path: '/tmp/kucedr-coding-test/sessions/session-1.jsonl',
		cwd: project.directory,
		name: undefined,
		created: new Date('2026-08-20T10:00:00.000Z'),
		modified: new Date('2026-08-20T10:01:00.000Z'),
		messageCount: 2,
		firstMessage: 'Inspect this project',
	};
	sessionManagerList
		.mockResolvedValueOnce([original])
		.mockResolvedValueOnce([{ ...original, name: 'Focused tests' }]);
	sessionManagerOpen.mockReturnValue({ appendSessionInfo });
	const coding = new Coder({
		store: { get: jest.fn(() => settings), set: jest.fn() } as unknown as CodingStore,
		projects: projects as unknown as CodingProjectStore,
		getProvider: () => undefined,
	});

	await expect(coding.renameSession(project.id, original.id, ' Focused tests ')).resolves.toEqual(
		expect.objectContaining({ title: 'Focused tests' })
	);
	expect(sessionManagerOpen).toHaveBeenCalledWith(
		original.path,
		'/tmp/kucedr-coding-test/sessions',
		project.directory
	);
	expect(appendSessionInfo).toHaveBeenCalledWith('Focused tests');
});
