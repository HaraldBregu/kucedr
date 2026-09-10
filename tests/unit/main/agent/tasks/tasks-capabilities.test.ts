const getSchedule = jest.fn();
const updateSchedule = jest.fn();

jest.mock('../../../../../src/main/tasks/tasks_get_schedule', () => ({ getSchedule }));
jest.mock('../../../../../src/main/tasks/tasks_update_schedule', () => ({ updateSchedule }));

import { configureScheduleCapabilities } from '../../../../../src/main/tasks/tasks_configure_capabilities';

beforeEach(() => {
	jest.clearAllMocks();
	getSchedule.mockReturnValue({
		id: 'schedule-1',
		enabled: false,
		prompt: 'check status',
		effort: 'low',
	});
	updateSchedule.mockImplementation((_id, patch) => ({ id: 'schedule-1', ...patch }));
});

it('lets the trusted settings surface enable a schedule with a normalized narrow allowlist', () => {
	configureScheduleCapabilities(' schedule-1 ', true, [' web_fetch ', 'knowledge_query', 'web_fetch']);

	expect(updateSchedule).toHaveBeenCalledWith('schedule-1', {
		enabled: true,
		toolsAllow: ['web_fetch', 'knowledge_query'],
	});
});

it('rejects invalid tool names', () => {
	expect(() => configureScheduleCapabilities('schedule-1', true, ['../exec'])).toThrow(
		'Schedule tool allowlist is invalid.'
	);
});
