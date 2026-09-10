const registerCommandWithEvent = jest.fn();
const registerQueryWithEvent = jest.fn();
const getSchedule = jest.fn();
const listSessions = jest.fn();
const pauseSchedule = jest.fn();
const resumeSchedule = jest.fn();

jest.mock('../../../../src/main/ipc/core/gateway', () => ({
	registerCommandWithEvent,
	registerQueryWithEvent,
}));
jest.mock('../../../../src/main/ipc/core/trusted', () => ({
	TrustedRenderer: jest.fn().mockImplementation(() => ({ assert: jest.fn() })),
}));
jest.mock('../../../../src/main/tasks', () => ({
	configureScheduleCapabilities: jest.fn(),
	deleteSchedule: jest.fn(),
	getSchedule,
	getRuntime: jest.fn(),
	listSchedules: jest.fn(),
	pauseSchedule,
	resumeSchedule,
	runScheduleNow: jest.fn(),
	setRuntime: jest.fn(),
}));

import { TaskIpc } from '../../../../src/main/ipc/tasks';
import { TaskChannels } from '../../../../src/shared/ipc_channels_definitions';

const event = { sender: { id: 1 } };

function command(channel: string): (...args: unknown[]) => unknown {
	return registerCommandWithEvent.mock.calls.find(([registered]) => registered === channel)?.[1];
}

function query(channel: string): (...args: unknown[]) => unknown {
	return registerQueryWithEvent.mock.calls.find(([registered]) => registered === channel)?.[1];
}

beforeEach(() => {
	registerCommandWithEvent.mockClear();
	registerQueryWithEvent.mockClear();
	getSchedule.mockReset();
	listSessions.mockReset();
	pauseSchedule.mockReset();
	resumeSchedule.mockReset();
	new TaskIpc().register(
		{ windows: {} as never, apps: {} as never, agent: { listSessions } as never },
		{} as never
	);
});

it('returns the agent sessions created by a task', () => {
	const session = { id: 'session-1', title: 'Nightly run', createdAtMs: 2 };
	getSchedule.mockReturnValue({ id: 'task-1', sessionIds: ['session-1'] });
	listSessions.mockReturnValue([session, { id: 'other', title: 'Other', createdAtMs: 1 }]);

	expect(query(TaskChannels.history)(event, 'task-1')).toEqual([session]);
	expect(getSchedule).toHaveBeenCalledWith('task-1');
	expect(listSessions).toHaveBeenCalledWith('task');
});

it('pauses and resumes a task from the enabled control', () => {
	command(TaskChannels.setEnabled)(event, 'task-1', false);
	command(TaskChannels.setEnabled)(event, 'task-1', true);

	expect(pauseSchedule).toHaveBeenCalledWith('task-1');
	expect(resumeSchedule).toHaveBeenCalledWith('task-1');
});
