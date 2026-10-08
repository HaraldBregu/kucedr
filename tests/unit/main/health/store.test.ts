jest.mock('../../../../src/main/shared/user_data_location', () => ({
	userDataLocation: () => '/tmp/kucedr-health-test',
}));

import {
	getHealthSettings,
	resetHealthSettings,
	updateHealthSettings,
} from '../../../../src/main/health/store';

it('persists and resets health settings independently', () => {
	updateHealthSettings({ every: '1h', modelOptions: { temperature: 0.2 } });
	expect(getHealthSettings().every).toBe('1h');
	expect(getHealthSettings().modelOptions).toEqual({ temperature: 0.2 });
	expect(resetHealthSettings().every).toBe('30m');
	expect(resetHealthSettings().modelOptions).toEqual({});
});

it('maps legacy intervals to cron schedules and preserves off', () => {
	updateHealthSettings({ every: '1h' });
	expect(getHealthSettings()).toMatchObject({ enabled: true, cronExpression: '0 * * * *' });
	updateHealthSettings({ every: '0m' });
	expect(getHealthSettings().enabled).toBe(false);
	resetHealthSettings();
	expect(getHealthSettings()).toMatchObject({ enabled: true, cronExpression: '*/30 * * * *' });
});

it('persists normalized custom cron settings', () => {
	updateHealthSettings({ enabled: false, cronExpression: '  0  9 * * 1-5  ' });
	expect(getHealthSettings()).toMatchObject({ enabled: false, cronExpression: '0 9 * * 1-5' });
});

it('rejects invalid cron settings before modifying any settings or model', () => {
	const previous = getHealthSettings();
	expect(() =>
		updateHealthSettings({ enabled: true, cronExpression: 'invalid', modelId: 'changed' })
	).toThrow('valid cron expression');
	expect(getHealthSettings()).toEqual(previous);
});
