jest.mock('../../../../../src/main/shared/user_data_location', () => ({
	userDataLocation: () => '/tmp/kucedr-health-test',
}));

import {
	getHealthSettings,
	resetHealthSettings,
	updateHealthSettings,
} from '../../../../../src/main/agent/health/health_store';

it('persists and resets health settings independently', () => {
	updateHealthSettings({ every: '1h', modelOptions: { temperature: 0.2 } });
	expect(getHealthSettings().every).toBe('1h');
	expect(getHealthSettings().modelOptions).toEqual({ temperature: 0.2 });
	expect(resetHealthSettings().every).toBe('30m');
	expect(resetHealthSettings().modelOptions).toEqual({});
});
