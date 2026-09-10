const writeState = jest.fn();
const listeners = new Set<(event: unknown) => void>();

jest.mock('../../../../../src/main/tasks/tasks_write_state', () => ({ writeState }));
jest.mock('../../../../../src/main/tasks/tasks_module_state', () => ({ listeners }));

import { emit } from '../../../../../src/main/tasks/tasks_emit';

const task = {
	id: 's1',
	name: 'Nightly',
	enabled: true,
	action: { type: 'debug' as const, message: 'run' },
	sessionIds: [],
	createdAt: '2026-09-10T08:00:00.000Z',
	updatedAt: '2026-09-10T08:00:00.000Z',
};

beforeEach(() => {
	writeState.mockReset();
	listeners.clear();
});

it('persists task events before notifying listeners', () => {
	const state = { schedules: [task], history: { s1: [] as unknown[] } };
	writeState.mockImplementation((mutate) => mutate(state));
	const listener = jest.fn();
	listeners.add(listener);

	emit(task, 'schedule.completed', 'Scheduled agent run completed.');

	expect(state.history.s1).toHaveLength(1);
	expect(state.history.s1[0]).toMatchObject({
		scheduleId: 's1',
		type: 'schedule.completed',
		message: 'Scheduled agent run completed.',
	});
	expect(listener).toHaveBeenCalledWith(state.history.s1[0]);
});
