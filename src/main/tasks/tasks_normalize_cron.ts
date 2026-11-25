import cron from 'node-cron';

export function normalizeCron(expression: string): string {
	const normalized = expression.trim().replace(/\s+/g, ' ');
	if (!normalized) return normalized;
	if (normalized.split(' ').length !== 5 || !cron.validate(normalized)) {
		throw new Error(`Invalid cron expression: ${expression}`);
	}
	if (cronInterval(normalized) < MIN_TASK_INTERVAL_MINUTES) {
		throw new Error(`A task can run at most once every ${MIN_TASK_INTERVAL_MINUTES} minutes.`);
	}
	return normalized;
}
