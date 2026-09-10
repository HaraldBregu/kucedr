const readState = jest.fn();

jest.mock('../../../../../src/main/tasks/tasks_read_state', () => ({
	readState,
}));

import { exists } from '../../../../../src/main/tasks/tasks_exists';
import { requireSchedule } from '../../../../../src/main/tasks/tasks_require_schedule';
import { getSchedule } from '../../../../../src/main/tasks/tasks_get_schedule';
import { listTaskHistory } from '../../../../../src/main/tasks/tasks_history';

const scheduleFixture = {
	id: 's1',
	name: 'Nightly',
	enabled: true,
	action: { type: 'agent', prompt: 'x' },
	createdAt: 'now',
	updatedAt: 'now',
};

beforeEach(() => {
	readState.mockReset().mockReturnValue({ schedules: [scheduleFixture] });
});

describe('exists', () => {
	it('is true for a known schedule id', () => {
		expect(exists('s1')).toBe(true);
	});
	it('is false for an unknown id', () => {
		expect(exists('nope')).toBe(false);
	});
});

describe('requireSchedule', () => {
	it('returns a clone of the matching schedule', () => {
		const result = requireSchedule('s1');
		expect(result).toEqual(scheduleFixture);
		expect(result).not.toBe(scheduleFixture);
	});
	it('throws when the schedule is missing', () => {
		expect(() => requireSchedule('nope')).toThrow(/Task schedule not found: nope/);
	});
});

describe('getSchedule', () => {
	it('delegates to requireSchedule', () => {
		expect(getSchedule('s1')).toEqual(scheduleFixture);
	});
});

describe('listTaskHistory', () => {
	it('returns a newest-first copy of the task event history', () => {
		const older = {
			eventId: 'older',
			scheduleId: 's1',
			type: 'schedule.triggered' as const,
			timestamp: '2026-09-10T08:00:00.000Z',
			message: 'Task started.',
		};
		const newer = {
			eventId: 'newer',
			scheduleId: 's1',
			type: 'schedule.completed' as const,
			timestamp: '2026-09-10T09:00:00.000Z',
			message: 'Task completed.',
		};
		readState.mockReturnValue({ schedules: [scheduleFixture], history: { s1: [older, newer] } });

		const history = listTaskHistory('s1');

		expect(history).toEqual([newer, older]);
		expect(history).not.toBe(readState.mock.results.at(-1)?.value.history.s1);
	});
});
