import cron, { type ScheduledTask } from 'node-cron';
import type { Agent } from '../agent/agent';
import { getHealth } from './data';
import { runHealthCheck } from './run';
import { getHealthSettings } from './store';
import type { HealthLogger } from './types';

let task: ScheduledTask | undefined;
let healthAgent: Agent | undefined;
let healthLogger: HealthLogger | undefined;

export function startHealth(agent: Agent, logger: HealthLogger): void {
	void getHealth(agent.config).catch((error) =>
		logger.error('Health', 'Failed to initialize HEALTH.md', error)
	);
	healthAgent = agent;
	healthLogger = logger;
	schedule();
}

export function stopHealth(): void {
	task?.destroy();
	task = undefined;
	healthAgent = undefined;
	healthLogger = undefined;
}

export function rescheduleHealth(): void {
	if (healthAgent) schedule();
}

function schedule(): void {
	task?.destroy();
	task = undefined;
	const agent = healthAgent;
	const logger = healthLogger;
	const settings = getHealthSettings();
	if (!settings.enabled || !agent || !logger) {
		logger?.info('Health', 'Health check disabled');
		return;
	}
	if (!cron.validate(settings.cronExpression)) {
		logger.error('Health', 'Invalid health schedule');
		return;
	}
	logger.info('Health', `Health check scheduled with ${settings.cronExpression}`);
	task = cron.schedule(
		settings.cronExpression,
		async () => {
			try {
				await runHealthCheck(agent, logger);
			} catch (error) {
				logger.error('Health', 'Health check failed', error);
			}
		},
		{ noOverlap: true, unref: true }
	);
}
