jest.mock('../../../../src/main/health/data', () => ({
	getHealth: jest.fn(async () => '- Update the workspace report'),
}));
jest.mock('../../../../src/main/health/store', () => ({
	getHealthSettings: () => ({ skipWhenBusy: true, isolatedSession: true }),
}));

import type { Agent } from '../../../../src/main/agent/agent';
import { runHealthCheck } from '../../../../src/main/health/run';

it('runs health checklists with the default background tools and no approval window', async () => {
	const send = jest.fn().mockResolvedValue('HEALTH_OK');
	const agent = {
		config: { location: '/workspace' },
		isBusy: () => false,
		send,
	} as unknown as Agent;
	await runHealthCheck(agent, { info: jest.fn(), error: jest.fn() });
	expect(send).toHaveBeenCalledWith(
		expect.stringContaining('Update the workspace report'),
		'health',
		{
			type: 'background',
			streaming: false,
			contextMode: 'minimal',
			sessionId: 'health',
			modelOptions: {},
		}
	);
});
