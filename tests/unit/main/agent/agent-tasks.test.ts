const mockAssociateSession = jest.fn();
const mockSetTaskRunner = jest.fn();
const mockStartTask = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../../src/main/shared/agent_location', () => ({
	agentLocation: () => '/tmp/kucedr-agent-tasks',
}));
jest.mock('../../../../src/main/tasks', () => ({
	associateSession: (...args: unknown[]) => mockAssociateSession(...args),
	initTask: jest.fn(),
	destroyTask: jest.fn(),
	getRuntime: jest.fn(() => ({ providerId: 'task-provider', modelId: 'task-model' })),
	setTaskRunner: (...args: unknown[]) => mockSetTaskRunner(...args),
	startTask: (...args: unknown[]) => mockStartTask(...args),
}));
jest.mock('../../../../src/main/agent/health', () => ({
	startHealth: jest.fn(),
	stopHealth: jest.fn(),
}));
jest.mock('../../../../src/main/agent/permissions', () => ({
	rejectPendingToolPermissions: jest.fn(),
}));

import { Agent } from '../../../../src/main/agent/agent';
import type { ExecSandbox } from '../../../../src/main/agent/sandbox';
import type { TaskRunner, TaskSchedule } from '../../../../src/main/tasks';
import type { WindowFactory } from '../../../../src/main/window_factory';

it('prevents scheduled agents from mutating tasks while honoring saved tool restrictions', async () => {
	const sandbox = { reset: jest.fn() } as unknown as ExecSandbox;
	const agent = new Agent({} as WindowFactory, sandbox);
	const send = jest.spyOn(agent, 'send').mockResolvedValue('done');
	agent.start({ info: jest.fn(), error: jest.fn() });
	const runner = mockSetTaskRunner.mock.calls[0][0] as TaskRunner;
	const toolsDeny = [
		'create_task',
		'update_task',
		'pause_task',
		'resume_task',
		'delete_task',
		'run_task_now',
	];
	const schedule = (toolsAllow?: string[]): TaskSchedule => ({
		id: 'schedule-1',
		name: 'Daily task',
		enabled: true,
		prompt: 'Do the work',
		toolsAllow,
		createdAt: '2026-08-11T00:00:00.000Z',
		updatedAt: '2026-08-11T00:00:00.000Z',
	});

	await runner(schedule());
	await runner(schedule([]));
	await runner(schedule(['read', 'bash']));

	for (const [index, call] of send.mock.calls.slice(0, 2).entries()) {
		expect(call).toEqual([
			'Do the work',
			'tasks',
			{
				type: 'background',
				sessionId: mockAssociateSession.mock.calls[index][1],
				toolsDeny,
				streaming: false,
				contextMode: 'minimal',
				providerId: 'task-provider',
				modelId: 'task-model',
			},
		]);
	}
	expect(send.mock.calls[2]).toEqual([
		'Do the work',
		'tasks',
		{
			type: 'background',
			sessionId: mockAssociateSession.mock.calls[2][1],
			toolsAllow: ['read', 'bash'],
			toolsDeny,
			streaming: false,
			contextMode: 'minimal',
			providerId: 'task-provider',
			modelId: 'task-model',
		},
	]);
	expect(mockAssociateSession.mock.calls).toHaveLength(3);
	for (const [taskId, sessionId] of mockAssociateSession.mock.calls) {
		expect(taskId).toBe('schedule-1');
		expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);
	}
	expect(new Set(mockAssociateSession.mock.calls.map((call) => call[1])).size).toBe(3);

	agent.destroy();
});
