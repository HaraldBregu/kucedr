const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const resolveSessionId = jest.fn(() => SESSION_ID);
const resolveStoredSessionId = jest.fn(() => SESSION_ID);
const clearMessages = jest.fn();
const deleteSession = jest.fn();
const order: string[] = [];

interface ControlledRun {
	started: Promise<void>;
	release: () => void;
	signal?: AbortSignal;
}

const controls = new Map<string, ControlledRun>();

function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve = () => {};
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

function controlRun(runId: string): ControlledRun {
	const started = deferred();
	const release = deferred();
	const control: ControlledRun = { started: started.promise, release: release.resolve };
	controls.set(runId, control);
	(control as ControlledRun & { markStarted: () => void; wait: Promise<void> }).markStarted =
		started.resolve;
	(control as ControlledRun & { wait: Promise<void> }).wait = release.promise;
	return control;
}

jest.mock('../../../../src/main/shared/agent_location', () => ({
	agentLocation: () => '/tmp/kucedr-agent-session-lifecycle',
}));
jest.mock('../../../../src/main/tasks', () => ({
	initTask: jest.fn(),
	destroyTask: jest.fn(),
	getRuntime: jest.fn(),
	setTaskRunner: jest.fn(),
	startTask: jest.fn(),
}));
jest.mock('../../../../src/main/agent/health', () => ({
	startHealth: jest.fn(),
	stopHealth: jest.fn(),
}));
jest.mock('../../../../src/main/agent/permissions', () => ({
	rejectPendingToolPermissions: jest.fn(),
}));
jest.mock('../../../../src/main/agent/skills', () => ({
	parseSkillCommand: (message: string) => ({ message }),
}));
jest.mock('../../../../src/main/models', () => ({
	findModel: jest.fn(() => ({
		metadata: { documentationStatus: 'verified', promptAttachments: [] },
	})),
}));
jest.mock('../../../../src/main/agent/session', () => {
	const actual = jest.requireActual('../../../../src/main/agent/session');
	return {
		...actual,
		clearMessages: (...args: unknown[]) => {
			order.push('clear');
			clearMessages(...args);
		},
		deleteSession: (...args: unknown[]) => {
			order.push('delete');
			deleteSession(...args);
		},
		init: (
			state: { id: string },
			_config: unknown,
			input: { sessionId: string; runId: string }
		) => {
			state.id = input.sessionId;
			order.push(`init:${input.runId}`);
		},
		listSessions: jest.fn(() => []),
		loadMessages: jest.fn(() => []),
		resolveSessionId,
		resolveStoredSessionId,
		tryAppendRun: jest.fn(),
	};
});
jest.mock('../../../../src/main/agent/runner/run_stream', () => ({
	stream: async function* (
		_config: unknown,
		_session: unknown,
		input: { runId: string; sessionId: string },
		signal: AbortSignal
	) {
		const control = controls.get(input.runId) as ControlledRun & {
			markStarted: () => void;
			wait: Promise<void>;
		};
		control.signal = signal;
		order.push(`start:${input.runId}`);
		control.markStarted();
		await control.wait;
		order.push(`settle:${input.runId}`);
		if (signal.aborted) return;
		yield {
			type: 'run_finished',
			result: {
				text: `${input.runId} reply`,
				model: 'model',
				toolCalls: [],
				numTurns: 1,
				subtype: 'success',
				sessionId: input.sessionId,
				stopReason: 'end_turn',
			},
		};
	},
}));

import { Agent } from '../../../../src/main/agent/agent';
import type { ExecSandbox } from '../../../../src/main/agent/sandbox';
import type { MemoryService } from '../../../../src/shared/memory_types';

beforeEach(() => {
	jest.clearAllMocks();
	controls.clear();
	order.length = 0;
});

it('captures completed main chat runs', async () => {
	const agentId = 'main';
	const capture = jest.fn(async () => undefined);
	const memory = { capture } as unknown as MemoryService;
	const agent = new Agent(
		{ reset: jest.fn() } as unknown as ExecSandbox,
		memory
	);
	const control = controlRun(`capture-${agentId}`);
	const response = agent.send('remember this', agentId, {
		type: agentId === 'main' ? 'default' : 'background',
		runId: `capture-${agentId}`,
		sessionId: agentId,
	});
	await control.started;
	control.release();
	await response;
	expect(capture).toHaveBeenCalledWith(SESSION_ID, expect.any(Array));
});

it.each(['channels', 'tasks', 'health'])('does not expose %s runs to personal memory', async (agentId) => {
	const capture = jest.fn(async () => undefined);
	const memory = { capture } as unknown as MemoryService;
	const agent = new Agent(
		{ reset: jest.fn() } as unknown as ExecSandbox,
		memory
	);
	const control = controlRun(`isolated-${agentId}`);
	const response = agent.send('private background content', agentId, {
		type: 'background',
		runId: `isolated-${agentId}`,
		sessionId: agentId,
	});
	await control.started;
	control.release();
	await response;
	expect(capture).not.toHaveBeenCalled();
});

it('rejects invalid current-turn attachments before session initialization', async () => {
	const agent = new Agent({ reset: jest.fn() } as unknown as ExecSandbox);
	await expect(
		agent.send('inspect', 'main', {
			type: 'default',
			runId: 'invalid-attachment',
			providerId: 'openai',
			model: 'test-model',
			files: [
				{
					name: '../secret.txt',
					mimeType: 'text/plain',
					data: Buffer.from('secret').toString('base64'),
				},
			],
		})
	).rejects.toThrow('safe basename');
	expect(order).not.toContain('init:invalid-attachment');
});

it.each([
	['clearMessages', clearMessages, 'clear'],
	['deleteSession', deleteSession, 'delete'],
] as const)(
	'enqueues %s before a replacement send while the cancelled run settles',
	async (method, mutate, mutationEvent) => {
		const agent = new Agent({ reset: jest.fn() } as unknown as ExecSandbox);
		const old = controlRun('old');
		const oldResponse = agent.send('old', 'health', {
			type: 'background',
			runId: 'old',
			sessionId: 'health',
		});
		await old.started;

		const maintenance = agent[method]('health');
		expect(old.signal?.aborted).toBe(true);
		const replacement = controlRun('replacement');
		const replacementResponse = agent.send('replacement', 'health', {
			type: 'background',
			runId: 'replacement',
			sessionId: 'health',
		});
		expect(mutate).not.toHaveBeenCalled();
		expect(order).not.toContain('start:replacement');

		old.release();
		await oldResponse;
		await replacement.started;
		expect(order).toEqual([
			'init:old',
			'start:old',
			'settle:old',
			mutationEvent,
			'init:replacement',
			'start:replacement',
		]);
		replacement.release();

		await expect(maintenance).resolves.toBeUndefined();
		await expect(replacementResponse).resolves.toBe('replacement reply');
		expect(resolveSessionId).toHaveBeenCalledWith('health', expect.any(String), 'health');
		expect(resolveStoredSessionId).toHaveBeenCalledWith('health', expect.any(String));
		expect(mutate).toHaveBeenCalledWith(
			expect.any(Object),
			expect.any(Object),
			SESSION_ID,
			expect.any(Object)
		);
	}
);

it('cancels queued same-session work before clear and keeps the replacement behind maintenance', async () => {
	const agent = new Agent({ reset: jest.fn() } as unknown as ExecSandbox);
	const running = controlRun('running');
	controlRun('queued');
	const runningResponse = agent.send('running', 'main', {
		type: 'default',
		runId: 'running',
		sessionId: 'main',
	});
	await running.started;
	const queuedResponse = agent.send('queued', 'main', {
		type: 'default',
		runId: 'queued',
		sessionId: 'main',
	});

	const maintenance = agent.clearMessages('main');
	await expect(queuedResponse).resolves.toBe('');
	expect(order).not.toContain('start:queued');
	const replacement = controlRun('replacement');
	const replacementResponse = agent.send('replacement', 'main', {
		type: 'default',
		runId: 'replacement',
		sessionId: 'main',
	});

	running.release();
	await runningResponse;
	await replacement.started;
	expect(order).toEqual([
		'init:running',
		'start:running',
		'settle:running',
		'clear',
		'init:replacement',
		'start:replacement',
	]);
	replacement.release();
	await maintenance;
	await expect(replacementResponse).resolves.toBe('replacement reply');
});
