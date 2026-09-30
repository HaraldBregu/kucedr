import type { Agent } from '../agent/agent';
import { runHealthCheck } from './run';
import { getHealthSettings } from './store';
import type { HealthEvery, HealthLogger } from './types';

const INTERVAL_MS: Record<HealthEvery, number> = {
	'0m': 0,
	'1m': 60_000,
	'30m': 1_800_000,
	'1h': 3_600_000,
};

let timer: ReturnType<typeof setInterval> | undefined;
let healthAgent: Agent | undefined;
let healthLogger: HealthLogger | undefined;

export function startHealth(agent: Agent, logger: HealthLogger): void {
	healthAgent = agent;
	healthLogger = logger;
	schedule();
}

export function stopHealth(): void {
	if (timer) clearInterval(timer);
	timer = undefined;
	healthAgent = undefined;
	healthLogger = undefined;
}

export function rescheduleHealth(): void {
	if (healthAgent) schedule();
}

function schedule(): void {
	if (timer) clearInterval(timer);
	timer = undefined;
	const agent = healthAgent;
	const logger = healthLogger;
	const every = getHealthSettings().every;
	const ms = INTERVAL_MS[every] ?? 0;
	if (!ms || !agent || !logger) {
		logger?.info('Health', 'Health check disabled');
		return;
	}
	logger.info('Health', `Health check scheduled every ${every}`);
	timer = setInterval(() => {
		runHealthCheck(agent, logger).catch((error) => {
			logger.error('Health', 'Health check failed', error);
		});
	}, ms);
	timer.unref();
}
