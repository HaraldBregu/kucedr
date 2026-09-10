const readState = jest.fn();

jest.mock('../../../../../src/main/tasks/tasks_read_state', () => ({
	readState,
}));

import { exists } from '../../../../../src/main/tasks/tasks_exists';
import { requireSchedule } from '../../../../../src/main/tasks/tasks_require_schedule';
import { getSchedule } from '../../../../../src/main/tasks/tasks_get_schedule';

const scheduleFixture = {
	id: 's1',
	name: 'Nightly',
	enabled: true,
	prompt: 'x',
	effort: 'low',
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
