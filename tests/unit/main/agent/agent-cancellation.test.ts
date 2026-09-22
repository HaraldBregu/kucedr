const mockRejectPendingToolPermissions = jest.fn();
const mockStream = jest.fn();

jest.mock('../../../../src/main/shared/agent_location', () => ({
	agentLocation: () => '/tmp/kucedr-agent-cancellation',
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
	rejectPendingToolPermissions: (...args: unknown[]) => mockRejectPendingToolPermissions(...args),
}));
jest.mock('../../../../src/main/agent/skills', () => ({
	parseSkillCommand: (message: string) => ({ message }),
}));
jest.mock('../../../../src/main/agent/session', () => {
	const actual = jest.requireActual('../../../../src/main/agent/session');
	return {
		...actual,
		clearMessages: jest.fn(),
		deleteSession: jest.fn(),
		init: (state: { id: string }, _config: unknown, input: { sessionId: string }) => {
			state.id = input.sessionId;
		},
		listSessions: jest.fn(() => []),
		loadMessages: jest.fn(() => []),
		resolveSessionId: (sessionId: string | undefined, _location: string, category: string) =>
			sessionId ?? `${category}-session`,
		resolveStoredSessionId: (sessionId: string) => sessionId,
		tryAppendRun: jest.fn(),
	};
});
jest.mock('../../../../src/main/agent/runner/run_stream', () => ({
	stream: (...args: unknown[]) => mockStream(...args),
}));

import { Agent } from '../../../../src/main/agent/agent';
import type { RunContext } from '../../../../src/main/agent/context';
import type { ExecSandbox } from '../../../../src/main/agent/sandbox';

interface ControlledRun {
	started: Promise<void>;
	release: () => void;
	signal?: AbortSignal;
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve = () => {};
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

function controlRun(controls: Map<string, ControlledRun>, runId: string): ControlledRun {
	const started = deferred();
	const release = deferred();
	const control: ControlledRun = { started: started.promise, release: release.resolve };
	controls.set(runId, control);
	(control as ControlledRun & { markStarted: () => void; wait: Promise<void> }).markStarted =
		started.resolve;
	(control as ControlledRun & { wait: Promise<void> }).wait = release.promise;
	return control;
}

function sandbox(): ExecSandbox {
	return { reset: jest.fn() } as unknown as ExecSandbox;
}

describe('Agent scoped cancellation', () => {
	let controls: Map<string, ControlledRun>;
	let contexts: Map<string, RunContext>;

	beforeEach(() => {
		controls = new Map();
		contexts = new Map();
		mockRejectPendingToolPermissions.mockReset();
		mockStream.mockReset().mockImplementation(
			(
				_config: unknown,
				session: { runContext: RunContext },
				input: { runId: string; agentId: string; sessionId: string },
				signal: AbortSignal
			) =>
				(async function* () {
					const control = controls.get(input.runId) as ControlledRun & {
						markStarted: () => void;
						wait: Promise<void>;
					};
					contexts.set(input.runId, session.runContext);
					control.signal = signal;
					control.markStarted();
					yield { type: 'model_call_delta', delta: `${input.runId}:partial` };
					await Promise.race([
						control.wait,
						new Promise<void>((resolve) => {
							if (signal.aborted) resolve();
							else signal.addEventListener('abort', () => resolve(), { once: true });
						}),
					]);
					if (signal.aborted) return;
					if (input.runId === 'failure') throw new Error('boom');
					yield {
						type: 'run_finished',
						result: {
							text: `${input.agentId === 'channels' ? 'bot' : input.runId} reply`,
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
	});

	it('cancels only the owned UI run and returns its accumulated text', async () => {
		const agent = new Agent(sandbox());
		const ui = controlRun(controls, 'ui-run');
		const bot = controlRun(controls, 'bot-run');
		const uiResponse = agent.send('ui', 'main', {
			type: 'default',
			runId: 'ui-run',
			sessionId: 'ui-session',
			windowId: 11,
		});
		const botResponse = agent.send('bot', 'channels', {
			type: 'background',
			runId: 'bot-run',
			sessionId: 'bot-session',
		});
		await Promise.all([ui.started, bot.started]);
		const botCall = mockStream.mock.calls.find((call) => call[2].runId === 'bot-run');
		expect(botCall?.[2]).toMatchObject({ agentId: 'channels', contextMode: 'minimal' });

		expect(agent.cancel('ui-run', 12)).toBe(false);
		expect(ui.signal?.aborted).toBe(false);
		expect(agent.cancel('ui-run', 11)).toBe(true);
		expect(agent.cancel('ui-run', 11)).toBe(false);
		await expect(uiResponse).resolves.toBe('ui-run:partial');
		expect(bot.signal?.aborted).toBe(false);
		expect(mockRejectPendingToolPermissions).toHaveBeenCalledWith('ui-run');
		expect(mockRejectPendingToolPermissions).not.toHaveBeenCalledWith('bot-run');

		bot.release();
		await expect(botResponse).resolves.toBe('bot reply');
	});

	it('resolves a queued cancellation with empty text and admits a replacement', async () => {
		const agent = new Agent(sandbox());
		const activeControls = ['active-1', 'active-2', 'active-3'].map((runId) =>
			controlRun(controls, runId)
		);
		const active = activeControls.map((_control, index) =>
			agent.send('active', 'main', {
				type: 'default',
				runId: `active-${index + 1}`,
				sessionId: `session-${index + 1}`,
			})
		);
		await Promise.all(activeControls.map((control) => control.started));

		controlRun(controls, 'queued');
		const queued = agent.send('queued', 'main', {
			type: 'default',
			runId: 'queued',
			sessionId: 'queued-session',
			windowId: 20,
		});
		expect(agent.isBusy('main')).toBe(true);
		expect(agent.cancel('queued', 20)).toBe(true);
		await expect(queued).resolves.toBe('');

		const replacement = controlRun(controls, 'replacement');
		const replacementResponse = agent.send('replacement', 'main', {
			type: 'default',
			runId: 'replacement',
			sessionId: 'queued-session',
		});
		activeControls[0].release();
		await replacement.started;
		replacement.release();
		for (const control of activeControls.slice(1)) control.release();
		await Promise.all(active);
		await expect(replacementResponse).resolves.toBe('replacement reply');
		expect(contexts.has('queued')).toBe(false);
		expect(agent.isBusy('main')).toBe(false);
	});

	it('clears busy state after success, failure, and cancellation', async () => {
		const agent = new Agent(sandbox());
		for (const runId of ['success', 'failure', 'cancelled']) {
			const control = controlRun(controls, runId);
			const response = agent.send(runId, 'main', {
				type: 'default',
				runId,
				sessionId: runId,
			});
			expect(agent.isBusy('main')).toBe(true);
			await control.started;
			if (runId === 'cancelled') agent.cancel(runId);
			else control.release();
			if (runId === 'failure') await expect(response).rejects.toThrow('boom');
			else await expect(response).resolves.toEqual(expect.any(String));
			await Promise.resolve();
			expect(agent.isBusy('main')).toBe(false);
		}
	});

	it('isolates contexts for concurrent and same-session sequential runs', async () => {
		const agent = new Agent(sandbox());
		const first = controlRun(controls, 'first');
		const concurrent = controlRun(controls, 'concurrent');
		const sequential = controlRun(controls, 'sequential');
		const responses = [
			agent.send('first', 'main', {
				type: 'default',
				runId: 'first',
				sessionId: 'shared',
			}),
			agent.send('concurrent', 'channels', {
				type: 'background',
				runId: 'concurrent',
				sessionId: 'other',
			}),
			agent.send('sequential', 'main', {
				type: 'default',
				runId: 'sequential',
				sessionId: 'shared',
			}),
		];
		await Promise.all([first.started, concurrent.started]);
		contexts.get('first')?.loadedSkills.push({
			id: 'writer',
			name: 'Writer',
			canonicalRoot: '/skills/writer',
			instructions: 'write',
			trust: 'user-controlled',
			hash: 'hash',
			resources: [],
		});
		expect(agent.runningSkill()).toBe('Writer');
		first.release();
		await sequential.started;

		expect(contexts.get('first')).not.toBe(contexts.get('concurrent'));
		expect(contexts.get('first')).not.toBe(contexts.get('sequential'));
		expect(contexts.get('first')?.loadedSkills).not.toBe(
			contexts.get('sequential')?.loadedSkills
		);
		expect(contexts.get('first')?.fileAccess.readDirectories).not.toBe(
			contexts.get('sequential')?.fileAccess.readDirectories
		);

		concurrent.release();
		sequential.release();
		await Promise.all(responses);
	});

	it('retains global cancellation only for shutdown', async () => {
		const agent = new Agent(sandbox());
		const ui = controlRun(controls, 'ui-run');
		const bot = controlRun(controls, 'bot-run');
		const runs = [
			agent.send('ui', 'main', {
				type: 'default',
				runId: 'ui-run',
				sessionId: 'ui',
			}),
			agent.send('bot', 'channels', {
				type: 'background',
				runId: 'bot-run',
				sessionId: 'bot',
			}),
		];
		await Promise.all([ui.started, bot.started]);

		agent.cancelAll();
		await Promise.all(runs);
		expect(ui.signal?.aborted).toBe(true);
		expect(bot.signal?.aborted).toBe(true);
		expect(mockRejectPendingToolPermissions).toHaveBeenCalledWith();
	});
});
