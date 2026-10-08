const schedule = jest.fn();
const validate = jest.fn();
const destroy = jest.fn();
const getHealth = jest.fn();
const getHealthSettings = jest.fn();
const runHealthCheck = jest.fn();

jest.mock('node-cron', () => ({
	__esModule: true,
	default: { schedule, validate },
}));
jest.mock('../../../../src/main/health/data', () => ({ getHealth }));
jest.mock('../../../../src/main/health/store', () => ({ getHealthSettings }));
jest.mock('../../../../src/main/health/run', () => ({ runHealthCheck }));

import { rescheduleHealth, startHealth, stopHealth } from '../../../../src/main/health/schedule';
import type { Agent } from '../../../../src/main/agent/agent';

describe('Health schedule', () => {
	const agent = { config: {} } as Agent;
	const logger = { info: jest.fn(), error: jest.fn() };
	const settings = { enabled: true, cronExpression: '*/30 * * * *' };

	beforeEach(() => {
		stopHealth();
		jest.clearAllMocks();
		schedule.mockReturnValue({ destroy });
		validate.mockReturnValue(true);
		getHealth.mockResolvedValue('');
		getHealthSettings.mockReturnValue(settings);
		runHealthCheck.mockResolvedValue(undefined);
	});

	afterEach(() => stopHealth());

	it('schedules health checks without overlap or keeping the process alive', async () => {
		startHealth(agent, logger);
		expect(schedule).toHaveBeenCalledWith(settings.cronExpression, expect.any(Function), {
			noOverlap: true,
			unref: true,
		});
		expect(getHealth).toHaveBeenCalledWith(agent.config);
		await schedule.mock.calls[0][1]();
		expect(runHealthCheck).toHaveBeenCalledWith(agent, logger);
	});

	it('keeps the scheduled callback pending until the health check finishes', async () => {
		let finish!: () => void;
		runHealthCheck.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
		startHealth(agent, logger);
		let completed = false;
		const run = schedule.mock.calls[0][1]().then(() => {
			completed = true;
		});
		await Promise.resolve();
		expect(completed).toBe(false);
		finish();
		await run;
		expect(completed).toBe(true);
	});

	it('logs failed health checks without rejecting the scheduled callback', async () => {
		const error = new Error('Health check failed');
		runHealthCheck.mockRejectedValue(error);
		startHealth(agent, logger);
		await expect(schedule.mock.calls[0][1]()).resolves.toBeUndefined();
		expect(logger.error).toHaveBeenCalledWith('Health', 'Health check failed', error);
	});

	it('replaces the scheduled task when configuration changes', () => {
		startHealth(agent, logger);
		getHealthSettings.mockReturnValue({ ...settings, cronExpression: '0 * * * *' });
		rescheduleHealth();
		expect(destroy).toHaveBeenCalledTimes(1);
		expect(schedule).toHaveBeenLastCalledWith('0 * * * *', expect.any(Function), {
			noOverlap: true,
			unref: true,
		});
	});

	it('destroys the scheduled task when disabled without scheduling a replacement', () => {
		startHealth(agent, logger);
		getHealthSettings.mockReturnValue({ ...settings, enabled: false });
		rescheduleHealth();
		expect(destroy).toHaveBeenCalledTimes(1);
		expect(schedule).toHaveBeenCalledTimes(1);
	});

	it('does not schedule while disabled', () => {
		getHealthSettings.mockReturnValue({ ...settings, enabled: false });
		startHealth(agent, logger);
		expect(schedule).not.toHaveBeenCalled();
	});

	it('destroys the previous task and logs invalid cron expressions', () => {
		startHealth(agent, logger);
		validate.mockReturnValue(false);
		rescheduleHealth();
		expect(destroy).toHaveBeenCalledTimes(1);
		expect(schedule).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith('Health', 'Invalid health schedule');
	});

	it('destroys the task once when stopped and ignores subsequent rescheduling', () => {
		startHealth(agent, logger);
		stopHealth();
		stopHealth();
		rescheduleHealth();
		expect(destroy).toHaveBeenCalledTimes(1);
		expect(schedule).toHaveBeenCalledTimes(1);
	});
});
